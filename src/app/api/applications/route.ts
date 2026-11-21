import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import {
  getApplicationByUserId,
  getUserById,
  upsertApplication,
} from "@/lib/db";
import { AGREEMENT_TEXT } from "@/lib/agreement";
import { encryptSecret, decryptSecret, isValidSsn, maskSsn, normalizeSsn } from "@/lib/crypto";

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB per image, before base64

function isDataUrlImage(value: string | null): boolean {
  if (!value) return false;
  if (!value.startsWith("data:image/")) return false;
  // base64 payload is ~4/3 the size of the file; reject anything over ~4 MB encoded.
  if (value.length > 4 * 1024 * 1024 + 100) return false;
  return true;
}

/** The cleaner's own application — status only, SSN never leaves the server. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const app = await getApplicationByUserId(session.user.id);
  if (!app) return NextResponse.json({ application: null });
  let ssnMasked = "***-**-****";
  try {
    ssnMasked = maskSsn(decryptSecret(app.ssn_encrypted));
  } catch {
    ssnMasked = "***-**-****";
  }
  return NextResponse.json({
    application: {
      status: app.status,
      legal_name: app.legal_name,
      created_at: app.created_at,
      updated_at: app.updated_at,
      ssn_masked: ssnMasked,
      submitted: true,
    },
  });
}

/**
 * Submit (or re-submit after a denial) a cleaner application.
 * Only boi accounts. The SSN is encrypted before it touches the database
 * and is never logged. Status always starts (or resets to) pending.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  try {
    const user = await getUserById(session.user.id);
    if (!user || user.role !== "boi") {
      return NextResponse.json(
        { error: "Only cleaner (boi) accounts apply." },
        { status: 403 }
      );
    }

    const existing = await getApplicationByUserId(user.id);
    if (existing && existing.status === "approved") {
      return NextResponse.json(
        { error: "Your application is already approved — no need to apply again." },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const str = (v: unknown) => String(v ?? "").trim();

    const legalName = str(body?.legal_name);
    const dob = str(body?.dob);
    const address = str(body?.address);
    const phone = str(body?.phone);
    const ssnRaw = str(body?.ssn);
    const emergencyName = str(body?.emergency_contact_name);
    const emergencyPhone = str(body?.emergency_contact_phone);
    const experience = str(body?.experience);
    const availability = str(body?.availability);
    const serviceAreas = str(body?.service_areas);
    const photoData = str(body?.photo_data) || null;
    const idUploadData = str(body?.id_upload_data) || null;
    const signature = str(body?.agreement_signature);
    const agreed = body?.agreed === true;

    const missing: string[] = [];
    if (!legalName) missing.push("full legal name");
    if (!dob) missing.push("date of birth");
    if (!address) missing.push("address");
    if (!phone) missing.push("phone");
    if (!ssnRaw) missing.push("SSN");
    if (!emergencyName) missing.push("emergency contact name");
    if (!emergencyPhone) missing.push("emergency contact phone");
    if (!experience) missing.push("cleaning experience");
    if (!availability) missing.push("availability");
    if (!serviceAreas) missing.push("service areas");
    if (!photoData) missing.push("profile photo");
    if (!idUploadData) missing.push("ID upload");
    if (!signature) missing.push("agreement signature");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Please fill in: ${missing.join(", ")}.` },
        { status: 400 }
      );
    }

    if (!isValidSsn(ssnRaw)) {
      return NextResponse.json(
        { error: "Enter a valid 9-digit SSN." },
        { status: 400 }
      );
    }
    if (photoData && !isDataUrlImage(photoData)) {
      return NextResponse.json(
        { error: "Profile photo must be an image under 3 MB." },
        { status: 400 }
      );
    }
    if (idUploadData && !isDataUrlImage(idUploadData)) {
      return NextResponse.json(
        { error: "ID upload must be an image under 3 MB." },
        { status: 400 }
      );
    }
    if (!agreed) {
      return NextResponse.json(
        { error: "You have to check the box that you read and agree to the contractor agreement." },
        { status: 400 }
      );
    }
    if (signature.toLowerCase() !== legalName.toLowerCase()) {
      return NextResponse.json(
        { error: "The signature has to match your full legal name." },
        { status: 400 }
      );
    }

    // Encrypt the SSN now — the plaintext value never reaches the database
    // and is never logged.
    const ssnEncrypted = encryptSecret(normalizeSsn(ssnRaw));

    const app = await upsertApplication(existing?.id ?? randomUUID(), user.id, {
      legal_name: legalName,
      dob,
      address,
      phone,
      ssn_encrypted: ssnEncrypted,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      experience,
      availability,
      service_areas: serviceAreas,
      photo_data: photoData,
      id_upload_data: idUploadData,
      agreement_text: AGREEMENT_TEXT,
      agreement_signature: signature,
      agreement_signed_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, status: app.status });
  } catch (err) {
    console.error("application error", err);
    return NextResponse.json(
      { error: "Could not save the application. Please try again." },
      { status: 500 }
    );
  }
}
