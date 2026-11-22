import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getUserById, deleteUser } from "@/lib/db";

/**
 * Admin delete of an account. Gated to ADMIN_EMAIL only.
 * Deletes the user's row plus their applications, listings, and
 * bookings (client or boi) so nothing is orphaned. The admin account
 * itself can never be deleted. Never touches Stripe — a deleted
 * user's Stripe customer/subscription is left alone.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "");
    if (!id) {
      return NextResponse.json(
        { error: "Provide an account id." },
        { status: 400 }
      );
    }
    const target = await getUserById(id);
    if (!target) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (isAdminEmail(target.email)) {
      return NextResponse.json(
        { error: "The admin account cannot be deleted." },
        { status: 400 }
      );
    }
    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("admin delete error", err);
    return NextResponse.json(
      { error: "Could not delete the account." },
      { status: 500 }
    );
  }
}
