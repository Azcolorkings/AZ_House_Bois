import { NextResponse, after } from "next/server";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import {
  getBookingById,
  getListingById,
  getUserById,
  setBookingRefund,
  updateBookingStatus,
  type BookingRow,
} from "@/lib/db";
import {
  formatCents,
  frequencyLabel,
  serviceLabel,
  timeSlotLabel,
} from "@/lib/pricing";
import {
  notifyHomeownerBookingUpdate,
  sendAdminNotification,
} from "@/lib/notify";

/**
 * Confirm / decline / cancel one booking.
 * Body: { action: "confirm" | "decline" | "cancel" }
 *
 * - confirm: only the boi, only a paid requested booking.
 * - decline: only the boi, only a requested booking. A paid booking is
 *   refunded through Stripe; if the refund fails, the booking is still
 *   declined and flagged needs_refund so the admin refunds it by hand.
 * - cancel: only the homeowner, on a requested or confirmed booking.
 *   Requested + paid → same refund attempt as decline. Confirmed → no
 *   automatic refund (the boi already committed); flagged needs_refund
 *   for the owner to handle manually. Unpaid → nothing to refund.
 * A refund failure never fails the request.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await params;
  const booking = await getBookingById(id);
  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  if (action !== "confirm" && action !== "decline" && action !== "cancel") {
    return NextResponse.json(
      { error: "Action must be confirm, decline, or cancel." },
      { status: 400 }
    );
  }

  try {
    if (action === "confirm" || action === "decline") {
      if (booking.boi_user_id !== session.user.id) {
        return NextResponse.json(
          { error: "Only the booked boi can do that." },
          { status: 403 }
        );
      }
      if (booking.status !== "requested") {
        return NextResponse.json(
          { error: `This booking is already ${booking.status}.` },
          { status: 409 }
        );
      }
      if (action === "confirm") {
        if (!booking.paid_at) {
          return NextResponse.json(
            { error: "Payment hasn't completed yet — nothing to confirm." },
            { status: 409 }
          );
        }
        const updated = await updateBookingStatus(booking.id, "confirmed");
        after(() => void notifyHomeowner(booking, "confirmed", false));
        return NextResponse.json({ ok: true, status: updated?.status });
      }

      // decline
      let refunded = false;
      if (booking.paid_at && booking.stripe_payment_intent_id) {
        refunded = await tryRefund(booking);
      } else {
        await setBookingRefund(booking.id, "not_required", false);
      }
      const updated = await updateBookingStatus(booking.id, "declined");
      if (!refunded && booking.paid_at) {
        after(() =>
          void notifyAdminRefundNeeded(booking, "declined by the boi")
        );
      }
      after(() => void notifyHomeowner(booking, "declined", refunded));
      return NextResponse.json({ ok: true, status: updated?.status, refunded });
    }

    // cancel — homeowner only
    if (booking.client_user_id !== session.user.id) {
      return NextResponse.json(
        { error: "Only the homeowner who booked can cancel it." },
        { status: 403 }
      );
    }
    if (booking.status !== "requested" && booking.status !== "confirmed") {
      return NextResponse.json(
        { error: `This booking is already ${booking.status}.` },
        { status: 409 }
      );
    }

    if (booking.status === "confirmed") {
      // No automatic refund on a confirmed booking — the boi already
      // committed to the date. Flag it so the owner refunds by hand.
      await setBookingRefund(booking.id, "none", true);
      const updated = await updateBookingStatus(booking.id, "cancelled");
      after(() =>
        void notifyAdminRefundNeeded(
          booking,
          "cancelled by the homeowner after confirmation — refund by hand"
        )
      );
      return NextResponse.json({
        ok: true,
        status: updated?.status,
        refunded: false,
        note: "This booking was already confirmed, so the refund is handled manually by AZ House Bois.",
      });
    }

    // requested (not yet confirmed)
    let refunded = false;
    if (booking.paid_at && booking.stripe_payment_intent_id) {
      refunded = await tryRefund(booking);
    } else {
      await setBookingRefund(booking.id, "not_required", false);
    }
    const updated = await updateBookingStatus(booking.id, "cancelled");
    if (!refunded && booking.paid_at) {
      after(() =>
        void notifyAdminRefundNeeded(booking, "cancelled by the homeowner")
      );
    }
    return NextResponse.json({ ok: true, status: updated?.status, refunded });
  } catch (err) {
    console.error("booking action error", err);
    return NextResponse.json(
      { error: "Could not update the booking. Please try again." },
      { status: 500 }
    );
  }
}

/** Attempt a Stripe refund of the booking's payment. Never throws. */
async function tryRefund(booking: BookingRow): Promise<boolean> {
  try {
    const stripe = getStripe();
    await stripe.refunds.create({
      payment_intent: booking.stripe_payment_intent_id as string,
    });
    await setBookingRefund(booking.id, "refunded", false);
    return true;
  } catch (err) {
    // The live restricted key may not have refund permission, or the
    // payment may not be refundable yet — flag it and let the admin
    // refund it by hand in Stripe. The booking change still goes through.
    console.error("booking refund failed", {
      bookingId: booking.id,
      err: err instanceof Error ? err.message : String(err),
    });
    await setBookingRefund(booking.id, "failed", true);
    return false;
  }
}

async function notifyHomeowner(
  booking: BookingRow,
  status: "confirmed" | "declined",
  refunded: boolean
): Promise<boolean> {
  const client = await getUserById(booking.client_user_id);
  const listing = await getListingById(booking.listing_id);
  if (!client || !listing) return false;
  return notifyHomeownerBookingUpdate({
    clientEmail: client.email,
    boiName: listing.display_name,
    status,
    refunded,
    serviceLabel: serviceLabel(booking.service),
    amount: formatCents(booking.amount_cents),
    date: booking.date,
    timeLabel: timeSlotLabel(booking.time_slot),
    frequencyLabel: frequencyLabel(booking.frequency),
    address: booking.service_address,
    suppliesByHomeowner: booking.supplies_by_homeowner,
    notes: booking.notes,
  });
}

async function notifyAdminRefundNeeded(
  booking: BookingRow,
  reason: string
): Promise<boolean> {
  const client = await getUserById(booking.client_user_id);
  const listing = await getListingById(booking.listing_id);
  const text = [
    "A booking needs a manual refund in Stripe.",
    "",
    `Booking: ${booking.id}`,
    `Reason: ${reason}`,
    `Homeowner: ${client?.email ?? booking.client_user_id}`,
    `Boi: ${listing?.display_name ?? booking.boi_user_id}`,
    `Service: ${serviceLabel(booking.service)} — ${formatCents(booking.amount_cents)}`,
    `When: ${booking.date} at ${timeSlotLabel(booking.time_slot)}`,
    `Payment intent: ${booking.stripe_payment_intent_id ?? "unknown"}`,
    "",
    "Refund it in the Stripe Dashboard, then clear the flag on /admin/bookings.",
  ].join("\n");
  return sendAdminNotification(
    `Manual refund needed — booking ${booking.date} (${formatCents(booking.amount_cents)})`,
    text
  );
}
