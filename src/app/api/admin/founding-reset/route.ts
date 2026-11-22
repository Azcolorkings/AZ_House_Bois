import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { countFoundingFreeUsed, resetFoundingFreeUsed } from "@/lib/db";
import { FOUNDING_FREE_SPOTS } from "@/lib/pricing";

/**
 * Admin reopen of all founding free months. Gated to ADMIN_EMAIL only.
 * Clears founding_free_used for every user, so all 5 first-month-free
 * spots are available again (e.g. after a test account burned one).
 * Never touches Stripe — the coupon's own max_redemptions 5 is the
 * hard cap on Stripe's side and is unchanged.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  try {
    await resetFoundingFreeUsed();
    const used = await countFoundingFreeUsed();
    return NextResponse.json({
      ok: true,
      spotsLeft: Math.max(0, FOUNDING_FREE_SPOTS - used),
    });
  } catch (err) {
    console.error("admin founding reset error", err);
    return NextResponse.json(
      { error: "Could not reopen the founding spots." },
      { status: 500 }
    );
  }
}
