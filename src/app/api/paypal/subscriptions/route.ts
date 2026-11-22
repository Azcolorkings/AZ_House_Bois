import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPayPalSubscription,
  isPayPalConfigured,
  paypalSubscriptionCustomId,
  planConfigured,
  planIdForRole,
} from "@/lib/paypal";
import { FOUNDING_FREE_SPOTS } from "@/lib/pricing";
import {
  countFoundingFreeUsed,
  getApplicationByUserId,
  getUserById,
  hasSignedHomeownerAgreement,
} from "@/lib/db";

/**
 * Creates a PayPal subscription ($20/month) and returns its id for the
 * JS SDK button to approve. Mirrors POST /api/checkout exactly: same
 * gates (homeowner agreement for clients, approved application for
 * bois), same founding-offer check (boi only, first 5, flag NOT burned
 * here — only once the subscription activates, in the confirm route /
 * webhook). The buyer approves in the PayPal popup; nothing is charged
 * until then.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body?.role === "boi" ? "boi" : "client";

  if (!isPayPalConfigured()) {
    return NextResponse.json(
      {
        error:
          "PayPal checkout isn't set up yet — pay with a card for now, and PayPal will be an option soon.",
        code: "paypal-not-configured",
      },
      { status: 503 }
    );
  }

  const planId = planIdForRole(role);
  if (!planConfigured(planId)) {
    return NextResponse.json(
      {
        error:
          "PayPal subscriptions aren't open yet — the $20/month plans are still being set up on our PayPal account. Pay with a card for now.",
        code: "paypal-plans-not-configured",
      },
      { status: 503 }
    );
  }

  try {
    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Homeowners must sign the homeowner agreement & waiver before they
    // can subscribe — same gate as the Stripe checkout route.
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

    // Cleaners only pay after their application is approved — same gate
    // as the Stripe checkout route.
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

    // Founding offer (boi only, never homeowners): the first 5 approved
    // bois get their first month free. PayPal has no coupon, so the
    // free month is a $0 trial cycle on this subscription only (see
    // createPayPalSubscription). The flag is burned only on activation.
    let foundingFree = false;
    if (role === "boi" && !user.founding_free_used) {
      const used = await countFoundingFreeUsed();
      foundingFree = used < FOUNDING_FREE_SPOTS;
    }

    const subscription = await createPayPalSubscription(planId, {
      customId: paypalSubscriptionCustomId(user.id, role, foundingFree),
      foundingFree,
    });

    return NextResponse.json({ subscriptionId: subscription.id });
  } catch (err) {
    console.error("paypal subscription error", err);
    return NextResponse.json(
      { error: "Could not start PayPal checkout. Please try again." },
      { status: 500 }
    );
  }
}
