import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { getUserById } from "@/lib/db";

/** Opens the Stripe Customer Portal so a subscriber can manage/cancel. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  try {
    const user = await getUserById(session.user.id);
    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription on file yet." },
        { status: 400 }
      );
    }
    const stripe = getStripe();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://az-house-bois.vercel.app";
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("portal error", err);
    return NextResponse.json(
      { error: "Could not open the billing portal. Please try again." },
      { status: 500 }
    );
  }
}
