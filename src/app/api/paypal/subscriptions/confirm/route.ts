import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPayPalSubscription,
  isPayPalConfigured,
  parsePayPalCustomId,
} from "@/lib/paypal";
import {
  getUserById,
  markFoundingFreeUsed,
  updateUserPayPalSubscription,
} from "@/lib/db";

/**
 * Called by the JS SDK's onApprove after the buyer approves the
 * subscription in the PayPal popup. Fetches the subscription from
 * PayPal server-side and only marks it active when PayPal says ACTIVE
 * — the browser is never trusted on its own. The webhook
 * (BILLING.SUBSCRIPTION.ACTIVATED) does the same thing as a backstop,
 * so a missed confirm or a duplicate delivery is harmless.
 *
 * Founding offer: the founding_free_used flag is burned here ONLY once
 * the subscription actually exists and is ACTIVE — same rule as the
 * Stripe webhook. An abandoned approval never reaches this route.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: "PayPal checkout isn't set up yet." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const subscriptionId = String(body?.subscriptionId ?? "").trim();
  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No PayPal subscription to confirm." },
      { status: 400 }
    );
  }

  try {
    const subscription = await getPayPalSubscription(subscriptionId);
    if (subscription.status !== "ACTIVE") {
      return NextResponse.json(
        {
          error:
            "That PayPal subscription isn't active yet — finish the approval in PayPal and try again.",
        },
        { status: 409 }
      );
    }

    // The subscription must belong to the signed-in user — the
    // custom_id PayPal echoes back is the check, not the request body.
    const parsed = parsePayPalCustomId(subscription.custom_id);
    if (!parsed || parsed.userId !== session.user.id) {
      return NextResponse.json(
        { error: "That subscription doesn't belong to this account." },
        { status: 403 }
      );
    }

    const user = await getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    await updateUserPayPalSubscription(user.id, {
      subscription_status: "active",
      paypal_subscription_id: subscription.id,
      current_period_end:
        subscription.billing_info?.next_billing_time ?? undefined,
    });

    if (parsed.foundingFree) {
      await markFoundingFreeUsed(user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("paypal subscription confirm error", err);
    return NextResponse.json(
      { error: "Could not confirm the PayPal subscription. Please try again." },
      { status: 500 }
    );
  }
}
