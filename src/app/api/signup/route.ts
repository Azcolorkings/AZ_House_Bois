import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { createUser, getUserByEmail } from "@/lib/db";
import { HOMEOWNER_AGREEMENT_TEXT } from "@/lib/homeowner-agreement";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const role = body?.role === "boi" ? "boi" : "client";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Homeowners read and sign the homeowner agreement & waiver at signup,
    // before they can see the roster or subscribe. Cleaners sign their own
    // contractor agreement on the application instead.
    let homeownerAgreement: { text: string; signature: string; signedAt: string } | undefined;
    if (role === "client") {
      const signature = String(body?.homeowner_agreement_signature ?? "").trim();
      const agreed = body?.homeowner_agreed === true;
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
      homeownerAgreement = {
        text: HOMEOWNER_AGREEMENT_TEXT,
        signature,
        signedAt: new Date().toISOString(),
      };
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists. Try logging in." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser(randomUUID(), email, passwordHash, role, homeownerAgreement);
    return NextResponse.json({ ok: true, id: user.id, role: user.role });
  } catch (err) {
    console.error("signup error", err);
    return NextResponse.json(
      { error: "Could not create the account. Please try again." },
      { status: 500 }
    );
  }
}
