import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe, priceIdForRole, priceConfigured } from "@/lib/stripe";
import { FOUNDING_COUPON_ID, FOUNDING_FREE_SPOTS } from "@/lib/pricing";
import {
  countFoundingFreeUsed,
  getUserById,
  updateUserStripe,
  getApplicationByUserId,
  hasSignedHomeownerAgreement,
} from "@/lib/db";

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

    // Homeowners must sign the homeowner agreement & waiver before they
    // can subscribe — new signups sign at signup, older accounts sign from
    // their dashboard. No signature, no checkout.
    if (role === "client" && !hasSignedHomeownerAgreement(user)) {
      return NextResponse.json(
        {
          error:
            "Sign the homeowner agreement & waiver first — you can do that from your dashboard. It covers breakage and the zero-tolerance rule on harassment, and it only takes a minute.",
          code: "homeowner-agreement-required",
        },
        { status: 403 }
      );
    }

    // Cleaners only pay after their application is approved — nobody pays
    // to list before they've been accepted.
    if (role === "boi") {
      const app = await getApplicationByUserId(user.id);
      if (!app || app.status !== "approved") {
        return NextResponse.json(
          {
            error:
              app?.status === "pending"
                ? "Your cleaner application is still under review. You'll be able to subscribe once it's approved — you won't be charged before then."
                : app?.status === "denied"
                  ? "Your cleaner application was not approved. You can apply again from your dashboard — there's no charge to apply."
                  : "Cleaners apply first. Fill out the application and once it's approved you can subscribe to list.",
            code: "application-required",
          },
          { status: 403 }
        );
      }
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

    // Founding offer (boi only, never homeowners): the first 5 approved
    // bois get their first month free via the 100%-off coupon. A boi who
    // already used one does not get another.
    let foundingFree = false;
    if (role === "boi" && !user.founding_free_used) {
      const used = await countFoundingFreeUsed();
      foundingFree = used < FOUNDING_FREE_SPOTS;
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://az-house-bois.vercel.app";
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?subscribed=1`,
      cancel_url: `${appUrl}/pricing?cancelled=1`,
      metadata: { user_id: user.id, role },
      subscription_data: { metadata: { user_id: user.id, role } },
    };

    let checkout;
    if (foundingFree) {
      try {
        checkout = await stripe.checkout.sessions.create({
          ...sessionParams,
          discounts: [{ coupon: FOUNDING_COUPON_ID }],
          // Tag the coupon session so the webhook can burn the founding
          // spot ONLY when the subscription actually completes. The flag
          // is deliberately NOT on the plain fallback session below — a
          // boi who pays full price did not use a free month.
          metadata: { ...sessionParams.metadata, founding_free: "1" },
          subscription_data: {
            metadata: { user_id: user.id, role, founding_free: "1" },
          },
        });
      } catch (couponErr) {
        // The free month is a bonus, never a blocker: if Stripe rejects
        // the coupon (e.g. max redemptions reached), fall back to a plain
        // checkout so the boi can still subscribe.
        console.error(
          "founding coupon failed, plain checkout instead",
          couponErr
        );
        checkout = await stripe.checkout.sessions.create(sessionParams);
      }
    } else {
      checkout = await stripe.checkout.sessions.create(sessionParams);
    }

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("checkout error", err);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}
