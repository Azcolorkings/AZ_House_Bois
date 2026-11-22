import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  capturePayPalOrder,
  getPayPalOrder,
  isPayPalConfigured,
} from "@/lib/paypal";
import {
  getBookingById,
  markBookingPaid,
  setBookingRefund,
} from "@/lib/db";

/**
 * Called by the JS SDK's onApprove after the homeowner approves the
 * PayPal order for a booking. Verifies the order server-side first
 * (it must be the booking's order, still approvable), then captures
 * it, then marks the booking paid only when PayPal reports the capture
 * COMPLETED for exactly the booking amount. Mirrors the Stripe flow:
 * a booking paid after it was already cancelled is flagged
 * needs_refund for a manual refund.
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
  const orderId = String(body?.orderId ?? "").trim();
  const bookingId = String(body?.bookingId ?? "").trim();
  if (!orderId || !bookingId) {
    return NextResponse.json(
      { error: "Missing PayPal order or booking." },
      { status: 400 }
    );
  }

  try {
    const booking = await getBookingById(bookingId);
    if (!booking || booking.client_user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 }
      );
    }
    if (booking.payment_provider !== "paypal") {
      return NextResponse.json(
        { error: "That booking isn't a PayPal booking." },
        { status: 409 }
      );
    }
    if (booking.paid_at) {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }
    if (booking.paypal_order_id && booking.paypal_order_id !== orderId) {
      return NextResponse.json(
        { error: "That PayPal order doesn't match this booking." },
        { status: 409 }
      );
    }

    // The order must be this booking's order and still approvable —
    // checked against PayPal, not the request body.
    const order = await getPayPalOrder(orderId);
    const orderBookingId = order.purchase_units?.[0]?.custom_id;
    if (orderBookingId !== booking.id) {
      return NextResponse.json(
        { error: "That PayPal order doesn't match this booking." },
        { status: 409 }
      );
    }
    if (order.status !== "APPROVED" && order.status !== "CREATED") {
      return NextResponse.json(
        { error: "That PayPal order can't be captured." },
        { status: 409 }
      );
    }

    const captured = await capturePayPalOrder(orderId);
    const capture = captured.purchase_units?.[0]?.payments?.captures?.[0];
    if (!capture || capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "PayPal did not complete the payment." },
        { status: 502 }
      );
    }
    const capturedCents = Math.round(
      parseFloat(capture.amount?.value ?? "0") * 100
    );
    if (capturedCents !== booking.amount_cents) {
      console.error("paypal capture amount mismatch", {
        bookingId: booking.id,
        expected: booking.amount_cents,
        captured: capturedCents,
      });
      return NextResponse.json(
        { error: "The PayPal payment amount doesn't match the booking." },
        { status: 502 }
      );
    }

    await markBookingPaid(booking.id, null, capture.id);
    if (booking.status === "cancelled") {
      // Paid after the homeowner already cancelled — flag it so the
      // admin refunds it by hand in PayPal.
      await setBookingRefund(booking.id, "none", true);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("paypal order capture error", err);
    return NextResponse.json(
      { error: "Could not capture the PayPal payment. Please try again." },
      { status: 500 }
    );
  }
}
