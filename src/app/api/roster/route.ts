import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPublishedListings, getUserById, hasSignedHomeownerAgreement } from "@/lib/db";

/** Published boi listings. Only visible to signed-in clients with an active subscription — except the admin, who browses free. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  // The admin browses the roster free — he owns the site and should not
  // have to pay a membership to see who is on it. Everyone else still
  // needs the client role, a signed agreement, and an active $20/mo
  // membership. Booking still requires a paid subscription, admin included.
  const isAdmin = isAdminEmail(user.email);
  if (!isAdmin) {
    if (user.role !== "client") {
      return NextResponse.json(
        { error: "The roster is for homeowners only." },
        { status: 403 }
      );
    }
    // Homeowners must sign the homeowner agreement & waiver before browsing
    // — new signups sign at signup, older accounts sign from the dashboard.
    if (!hasSignedHomeownerAgreement(user)) {
      return NextResponse.json(
        {
          error: "Sign the homeowner agreement & waiver first — you can do that from your dashboard.",
          code: "homeowner-agreement-required",
        },
        { status: 403 }
      );
    }
    if (user.subscription_status !== "active") {
      return NextResponse.json(
        {
          error: "An active $20/month homeowner membership is required to browse the roster.",
          code: "subscription-required",
        },
        { status: 402 }
      );
    }
  }
  const city = new URL(req.url).searchParams.get("city") ?? undefined;
  const listings = await getPublishedListings({ city });
  return NextResponse.json({ listings });
}
