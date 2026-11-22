import { NextResponse } from "next/server";
import {
  getPayPalCapture,
  getPayPalOrder,
  getPayPalSubscription,
  isPayPalConfigured,
  parsePayPalCustomId,
  verifyPayPalWebhookSignature,
} from "@/lib/paypal";
import {
  getBookingByPayPalOrderId,
  markBookingPaid,
  markFoundingFreeUsed,
  setBookingRefund,
  updateUserPayPalSubscription,
} from "@/lib/db";

/**
 * PayPal webhook: keeps subscription status in sync, and marks PayPal
 * booking payments as paid. Mirrors /api/webhooks/stripe.
 *
 * Trust rule: when PAYPAL_WEBHOOK_ID is set, the delivery signature is
 * verified and a bad signature is rejected. When it is NOT set, the
 * event is still handled — but only after fetching the referenced
 * subscription/order/capture from PayPal server-side, so an unverified
 * payload can never change anything on its own. The webhook is a
 * backstop for the confirm/capture routes, which do the same fetches.
 *
 * Endpoint in the PayPal developer dashboard must point at
 * /api/webhooks/paypal and subscribe to:
 *   BILLING.SUBSCRIPTION.ACTIVATED, BILLING.SUBSCRIPTION.CANCELLED,
 *   BILLING.SUBSCRIPTION.SUSPENDED, BILLING.SUBSCRIPTION.PAYMENT.FAILED,
 *   BILLING.SUBSCRIPTION.EXPIRED, PAYMENT.CAPTURE.COMPLETED
 * Its webhook ID goes in PAYPAL_WEBHOOK_ID.
 */

interface PayPalWebhookEvent {
  event_type?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    amount?: { value?: string; currency_code?: string };
  };
}

export async function POST(req: Request) {
  if (!isPayPalConfigured()) {
    return NextResponse.json(
      { error: "PayPal is not configured." },
      { status: 503 }
    );
  }

  const payload = await req.text();
  let event: PayPalWebhookEvent;
  try {
    event = JSON.parse(payload) as PayPalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Signature check when a webhook ID is configured. Without it, fall
  // through to fetch-verification below — the handlers fetch every
  // resource from PayPal before acting.
  if (process.env.PAYPAL_WEBHOOK_ID) {
    const verified = await verifyPayPalWebhookSignature(
      {
        transmissionId: req.headers.get("paypal-transmission-id"),
        transmissionTime: req.headers.get("paypal-transmission-time"),
        transmissionSig: req.headers.get("paypal-transmission-sig"),
        certUrl: req.headers.get("paypal-cert-url"),
        authAlgo: req.headers.get("paypal-auth-algo"),
      },
      event
    );
    if (!verified) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 400 }
      );
    }
  } else {
    console.warn(
      "paypal webhook: PAYPAL_WEBHOOK_ID not set — verifying events by fetching from PayPal"
    );
  }

  try {
    const type = event.event_type ?? "";
    const resource = event.resource ?? {};

    // --- Subscriptions ---
    if (type.startsWith("BILLING.SUBSCRIPTION.")) {
      const subscriptionId = resource.id;
      if (!subscriptionId) {
        return NextResponse.json({ received: true });
      }
      // Fetch from PayPal — never trust the event payload's status.
      const subscription = await getPayPalSubscription(subscriptionId);
      const parsed = parsePayPalCustomId(subscription.custom_id);
      if (!parsed) {
        // Not one of ours (no custom_id) — nothing to do.
        return NextResponse.json({ received: true });
      }

      if (type === "BILLING.SUBSCRIPTION.ACTIVATED") {
        if (subscription.status === "ACTIVE") {
          await updateUserPayPalSubscription(parsed.userId, {
            subscription_status: "active",
            paypal_subscription_id: subscription.id,
            current_period_end:
              subscription.billing_info?.next_billing_time ?? undefined,
          });
          // Founding offer: burn one of the 5 free months ONLY now
          // that the subscription actually activated. Idempotent, so
          // a duplicate delivery or the confirm route firing first can
          // never burn two spots.
          if (parsed.foundingFree) {
            await markFoundingFreeUsed(parsed.userId);
          }
        }
      } else if (type === "BILLING.SUBSCRIPTION.CANCELLED") {
        await updateUserPayPalSubscription(parsed.userId, {
          subscription_status: "canceled",
          paypal_subscription_id: subscription.id,
        });
      } else if (type === "BILLING.SUBSCRIPTION.EXPIRED") {
        await updateUserPayPalSubscription(parsed.userId, {
          subscription_status: "canceled",
          paypal_subscription_id: subscription.id,
        });
      } else if (type === "BILLING.SUBSCRIPTION.SUSPENDED") {
        // PayPal suspends after failed payments — same as Stripe's
        // past_due: not active, not cancelled outright.
        await updateUserPayPalSubscription(parsed.userId, {
          subscription_status: "past_due",
          paypal_subscription_id: subscription.id,
        });
      } else if (type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED") {
        // Only downgrade when PayPal actually suspended it; a failed
        // payment on an otherwise ACTIVE subscription is retried by
        // PayPal and the membership stays live.
        if (subscription.status === "SUSPENDED") {
          await updateUserPayPalSubscription(parsed.userId, {
            subscription_status: "past_due",
            paypal_subscription_id: subscription.id,
          });
        }
      }
      return NextResponse.json({ received: true });
    }

    // --- One-time booking payments ---
    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const captureId = resource.id;
      if (!captureId) {
        return NextResponse.json({ received: true });
      }
      // Fetch the capture, then the order, then the booking — the
      // chain proves the payment belongs to a real booking.
      const capture = await getPayPalCapture(captureId);
      if (capture.status !== "COMPLETED") {
        return NextResponse.json({ received: true });
      }
      const orderId = capture.supplementary_data?.related_ids?.order_id;
      if (!orderId) {
        return NextResponse.json({ received: true });
      }
      const order = await getPayPalOrder(orderId);
      const bookingId = order.purchase_units?.[0]?.custom_id;
      if (!bookingId) {
        return NextResponse.json({ received: true });
      }
      const booking = await getBookingByPayPalOrderId(orderId);
      if (!booking || booking.id !== bookingId) {
        return NextResponse.json({ received: true });
      }
      if (!booking.paid_at) {
        const capturedCents = Math.round(
          parseFloat(capture.amount?.value ?? "0") * 100
        );
        if (capturedCents !== booking.amount_cents) {
          console.error("paypal webhook capture amount mismatch", {
            bookingId: booking.id,
            expected: booking.amount_cents,
            captured: capturedCents,
          });
          return NextResponse.json({ received: true });
        }
        await markBookingPaid(booking.id, null, capture.id);
      }
      if (booking.status === "cancelled") {
        // Paid after the homeowner already cancelled — flag it so
        // the admin refunds it by hand in PayPal.
        await setBookingRefund(booking.id, "none", true);
      }
      return NextResponse.json({ received: true });
    }

    // CHECKOUT.ORDER.APPROVED and anything else: nothing to do — the
    // capture route handles order approval, and unknown events are
    // acknowledged so PayPal stops retrying them.
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("paypal webhook handler error", err);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
