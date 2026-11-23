import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  getBookingByCheckoutSessionId,
  markBookingPaid,
  markFoundingFreeUsed,
  setBookingRefund,
  updateUserSubscriptionByCustomer,
} from "@/lib/db";

/**
 * Stripe webhook: keeps subscription status in sync, and marks one-time
 * booking payments as paid.
 * Endpoint in the Stripe Dashboard must point at /api/webhooks/stripe
 * and its signing secret goes in STRIPE_WEBHOOK_SECRET.
 *
 * Booking checkouts carry metadata { type: "booking", booking_id } and
 * are handled separately — they must NEVER touch subscription status
 * (a booking payment is not a subscription, and the session status
 * "complete" would otherwise overwrite the homeowner's status).
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 503 }
    );
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("webhook signature error", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    // One-time booking payment — mark the booking paid and stop here.
    // Subscription handling below must not run for these sessions.
    if (event.type === "checkout.session.completed") {
      const sessionObj = event.data.object as {
        metadata?: Record<string, string>;
        payment_intent?: string | { id?: string };
      };
      if (
        sessionObj.metadata?.type === "booking" &&
        sessionObj.metadata.booking_id
      ) {
        const booking = await getBookingByCheckoutSessionId(
          sessionObj.metadata.booking_id
        );
        if (booking) {
          if (!booking.paid_at) {
            const paymentIntentId =
              typeof sessionObj.payment_intent === "string"
                ? sessionObj.payment_intent
                : (sessionObj.payment_intent?.id ?? null);
            await markBookingPaid(booking.id, paymentIntentId);
          }
          if (booking.status === "cancelled") {
            // Paid after the homeowner already cancelled — flag it so
            // the admin refunds it by hand in Stripe.
            await setBookingRefund(booking.id, "none", true);
          }
        }
        return NextResponse.json({ received: true });
      }
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const obj = event.data.object as {
        customer?: string;
        id?: string;
        status?: string;
        current_period_end?: number;
        metadata?: Record<string, string>;
      };
      const customerId =
        typeof obj.customer === "string" ? obj.customer : undefined;
      if (customerId) {
        if (event.type === "checkout.session.completed") {
          // obj here is a Checkout Session, NOT a subscription: its
          // status is "complete", which is not a subscription status.
          // Writing it as the subscription status overwrote the
          // "active" set moments earlier by
          // customer.subscription.created (created ~1s before the
          // session event), so the dashboard kept showing "Not
          // subscribed yet" and the Subscribe button again — and the
          // boi could never reach the listing editor. A completed
          // subscription checkout means the subscription is live, and
          // the subscription id / period end belong to the subscription
          // events — never clobber them with the session's (absent)
          // values.
          await updateUserSubscriptionByCustomer(customerId, {
            subscription_status: "active",
          });
        } else {
          const status =
            event.type === "customer.subscription.deleted"
              ? "canceled"
              : obj.status ?? "active";
          await updateUserSubscriptionByCustomer(customerId, {
            subscription_status: status,
            stripe_subscription_id: (obj as { id?: string }).id,
            current_period_end: obj.current_period_end
              ? new Date(obj.current_period_end * 1000).toISOString()
              : undefined,
          });
        }
      }
      // Founding offer: burn one of the 5 free months ONLY now that
      // the subscription actually completed. The checkout session and
      // the subscription both carry metadata founding_free=1 when the
      // coupon was applied (set in POST /api/checkout), so either
      // event marks it — the UPDATE is idempotent, so a duplicate
      // delivery or both events firing can never burn two spots.
      // An abandoned checkout never reaches here, so it never burns one.
      const meta = obj.metadata ?? {};
      if (
        (event.type === "checkout.session.completed" ||
          event.type === "customer.subscription.created") &&
        meta.founding_free === "1" &&
        meta.user_id
      ) {
        await markFoundingFreeUsed(meta.user_id);
      }
    }
  } catch (err) {
    console.error("webhook handler error", err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
