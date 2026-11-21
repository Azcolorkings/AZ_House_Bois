import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getUserById,
  hasSignedHomeownerAgreement,
  signHomeownerAgreement,
} from "@/lib/db";
import { HOMEOWNER_AGREEMENT_TEXT } from "@/lib/homeowner-agreement";
import { isAtLeast18 } from "@/lib/age";

/** The homeowner's own agreement status — signature itself never leaves the server. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  return NextResponse.json({
    signed: hasSignedHomeownerAgreement(user),
    signed_at: user.homeowner_agreement_signed_at,
  });
}

/**
 * Sign the homeowner agreement & waiver. Homeowner (client) accounts only.
 * For homeowners who created their account before the agreement existed —
 * new signups sign at signup instead. One signature per account.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  try {
    const user = await getUserById(session.user.id);
    if (!user || user.role !== "client") {
      return NextResponse.json(
        { error: "Only homeowner accounts sign this agreement." },
        { status: 403 }
      );
    }
    if (hasSignedHomeownerAgreement(user)) {
      return NextResponse.json(
        { error: "You've already signed the homeowner agreement." },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const signature = String(body?.signature ?? "").trim();
    const agreed = body?.agreed === true;
    const dob = String(body?.dob ?? "").trim();

    if (!agreed) {
      return NextResponse.json(
        { error: "You have to check the box that you read and agree to the homeowner agreement & waiver." },
        { status: 400 }
      );
    }
    if (!signature) {
      return NextResponse.json(
        { error: "Type your full name to sign the homeowner agreement & waiver." },
        { status: 400 }
      );
    }
    if (!dob) {
      return NextResponse.json(
        { error: "Enter your date of birth." },
        { status: 400 }
      );
    }
    if (!isAtLeast18(dob)) {
      return NextResponse.json(
        { error: "You have to be 18 or older to sign the homeowner agreement." },
        { status: 400 }
      );
    }

    const signed = await signHomeownerAgreement(user.id, {
      text: HOMEOWNER_AGREEMENT_TEXT,
      signature,
      signedAt: new Date().toISOString(),
      dob,
    });
    if (!signed) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, signed_at: signed.homeowner_agreement_signed_at });
  } catch (err) {
    console.error("homeowner agreement error", err);
    return NextResponse.json(
      { error: "Could not save your signature. Please try again." },
      { status: 500 }
    );
  }
}
