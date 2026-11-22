import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById, setUserSuspended } from "@/lib/db";

/**
 * Admin suspend / unsuspend of an account. Gated to ADMIN_EMAIL only.
 * Suspending blocks sign-in and kills the account's live sessions via
 * the auth layer — it never deletes anything and never touches Stripe.
 * The admin account itself can never be suspended.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "");
    const suspended = body?.suspended === true;
    if (!id || typeof body?.suspended !== "boolean") {
      return NextResponse.json(
        { error: "Provide an account id and suspended true or false." },
        { status: 400 }
      );
    }
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (isAdminEmail(target.email)) {
      return NextResponse.json(
        { error: "The admin account cannot be suspended." },
        { status: 400 }
      );
    }
    const updated = await setUserSuspended(id, suspended);
    return NextResponse.json({ ok: true, suspended: updated?.suspended ?? suspended });
  } catch (err) {
    console.error("admin suspend error", err);
    return NextResponse.json(
      { error: "Could not update the account." },
      { status: 500 }
    );
  }
}
