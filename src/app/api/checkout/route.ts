import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe, priceIdForRole, priceConfigured } from "@/lib/stripe";
import { getUserById, updateUserStripe } from "@/lib/db";

/**
 * Creates a Stripe Checkout session for a $20/month recurring subscription.
 * The price IDs are placeholders until the two live $20/month products are
 * created on the confirmed AZ House Bois Stripe account — until then this
 * route refuses with a clear message instead of charging anyone.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body?.role === "boi" ? "boi" : "client";
  const priceId = priceIdForRole(role);

  if (!priceConfigured(priceId)) {
    return NextResponse.json(
      {
        error:
          "Subscriptions are not open yet — the $20/month plans are still being set up on our Stripe account. Join the early list and you'll be first in when they go live.",
        code: "subscriptions-not-configured",
      },
      { status: 503 }
    );
  }

  try {
    const stripe = getStripe();
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, role },
      });
      customerId = customer.id;
      await updateUserStripe(user.id, { stripe_customer_id: customerId });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://az-house-bois.vercel.app";
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?subscribed=1`,
      cancel_url: `${appUrl}/pricing?cancelled=1`,
      metadata: { user_id: user.id, role },
      subscription_data: { metadata: { user_id: user.id, role } },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("checkout error", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
