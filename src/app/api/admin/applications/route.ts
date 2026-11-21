import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { listApplications, updateApplicationStatus } from "@/lib/db";
import { decryptSecret, maskSsn } from "@/lib/crypto";

/**
 * Admin review of cleaner applications. Gated to ADMIN_EMAIL only.
 * The SSN is decrypted server-side for the admin — Steven needs it for
 * 1099 filing. It is never logged.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  try {
    const apps = await listApplications();
    const out = apps.map((a) => {
      let ssn = "";
      try {
        ssn = decryptSecret(a.ssn_encrypted);
      } catch {
        ssn = "";
      }
      return {
        id: a.id,
        email: a.email,
        legal_name: a.legal_name,
        dob: a.dob,
        address: a.address,
        phone: a.phone,
        ssn,
        ssn_masked: maskSsn(ssn),
        emergency_contact_name: a.emergency_contact_name,
        emergency_contact_phone: a.emergency_contact_phone,
        experience: a.experience,
        availability: a.availability,
        service_areas: a.service_areas,
        photo_data: a.photo_data,
        id_upload_data: a.id_upload_data,
        agreement_text: a.agreement_text,
        agreement_signature: a.agreement_signature,
        agreement_signed_at: a.agreement_signed_at,
        status: a.status,
        reviewed_at: a.reviewed_at,
        reviewed_by: a.reviewed_by,
        created_at: a.created_at,
        updated_at: a.updated_at,
      };
    });
    return NextResponse.json({ applications: out });
  } catch (err) {
    console.error("admin applications error", err);
    return NextResponse.json(
      { error: "Could not load applications." },
      { status: 500 }
    );
  }
}

/** Approve or deny one application. Body: { id, action: "approve" | "deny" } */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "");
    const action = body?.action === "approve" ? "approved" : body?.action === "deny" ? "denied" : null;
    if (!id || !action) {
      return NextResponse.json(
        { error: "Provide an application id and approve or deny." },
        { status: 400 }
      );
    }
    const updated = await updateApplicationStatus(id, action, session.user.email);
    if (!updated) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    console.error("admin review error", err);
    return NextResponse.json(
      { error: "Could not update the application." },
      { status: 500 }
    );
  }
}
