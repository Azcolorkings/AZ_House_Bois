import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import {
  createPayPalOrder,
  isPayPalConfigured,
} from "@/lib/paypal";
import {
  createBooking,
  getApplicationByUserId,
  getListingById,
  getUserById,
  hasSignedHomeownerAgreement,
  setBookingCheckoutSession,
  setBookingPayPalOrder,
  updateUserStripe,
} from "@/lib/db";
import {
  formatCents,
  frequencyLabel,
  isFrequencyKey,
  isServiceKey,
  isTimeSlot,
  priceForService,
  serviceLabel,
  splitAmount,
  timeSlotLabel,
} from "@/lib/pricing";
import { notifyBoiNewBooking, notifyNewBooking } from "@/lib/notify";
import { verifyBookingAddress } from "@/lib/google-maps";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create a booking and start a one-time payment for it — Stripe
 * Checkout by default, or a PayPal order when the homeowner picks
 * PayPal. The amount is ALWAYS re-derived from src/lib/pricing.ts — a
 * client-sent amount is never trusted. Payment covers the single
 * upcoming clean only; frequency is informational (no recurring billing).
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (user.role !== "client") {
    return NextResponse.json(
      { error: "Only homeowners can book a clean." },
      { status: 403 }
    );
  }
  if (!hasSignedHomeownerAgreement(user)) {
    return NextResponse.json(
      {
        error:
          "Sign the homeowner agreement & waiver first — you can do that from your dashboard.",
        code: "homeowner-agreement-required",
      },
      { status: 403 }
    );
  }
  if (user.subscription_status !== "active") {
    return NextResponse.json(
      {
        error:
          "An active $20/month homeowner membership is required to book a clean.",
        code: "subscription-required",
      },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const str = (v: unknown) => String(v ?? "").trim();

  const listingId = str(body?.listing_id);
  const service = body?.service;
  const date = str(body?.date);
  const timeSlot = str(body?.time_slot);
  const frequency = body?.frequency;
  const serviceAddress = str(body?.service_address);
  const suppliesByHomeowner = body?.supplies_by_homeowner === true;
  const notes = str(body?.notes);
  // "paypal" only when the homeowner picked it; anything else is Stripe.
  const paymentProvider = body?.payment_provider === "paypal" ? "paypal" : "stripe";

  // Fail before creating the booking when PayPal was picked but isn't
  // set up — the homeowner can just pick the card option instead.
  if (paymentProvider === "paypal" && !isPayPalConfigured()) {
    return NextResponse.json(
      {
        error:
          "PayPal checkout isn't set up yet — pay with a card for now, and PayPal will be an option soon.",
        code: "paypal-not-configured",
      },
      { status: 503 }
    );
  }

  if (!listingId) {
    return NextResponse.json({ error: "Pick a boi to book." }, { status: 400 });
  }
  if (!isServiceKey(service)) {
    return NextResponse.json(
      { error: "Pick a service: regular, deep, or move-in / move-out." },
      { status: 400 }
    );
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "Pick a valid date." },
      { status: 400 }
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  if (date < today) {
    return NextResponse.json(
      { error: "That date is in the past — pick a date from today on." },
      { status: 400 }
    );
  }
  if (!isTimeSlot(timeSlot)) {
    return NextResponse.json({ error: "Pick a time slot." }, { status: 400 });
  }
  if (!isFrequencyKey(frequency)) {
    return NextResponse.json(
      { error: "Pick how often: one-time, weekly, every 2 weeks, or monthly." },
      { status: 400 }
    );
  }
  if (!serviceAddress) {
    return NextResponse.json(
      { error: "Enter the address for the clean." },
      { status: 400 }
    );
  }

  // Google Maps check (fail-soft): when a Maps key is configured, the
  // address must be a real US street address — a place picked from the
  // autocomplete dropdown is confirmed via Place Details, a typed
  // address with no place picked is geocoded (a city or state alone
  // doesn't pass; it needs a street number + street name). With no
  // key configured this passes everything through, exactly like
  // before the feature existed. Coordinates stored below always come
  // from Google, never from the request body.
  const placeId = str(body?.place_id);
  const verification = await verifyBookingAddress({
    address: serviceAddress,
    placeId: placeId || undefined,
  });
  if (!verification.ok) {
    return NextResponse.json(
      {
        error:
          "That address doesn't look like a real street address — pick one of the Google suggestions as you type, or double-check the number and spelling.",
      },
      { status: 400 }
    );
  }
  // Google's canonical address when verified; the typed text when the
  // check was skipped (no key configured).
  const verifiedAddress = verification.formattedAddress ?? serviceAddress;
  const verifiedPlaceId = verification.skipped
    ? null
    : (verification.placeId ?? null);
  const verifiedLat = verification.skipped
    ? null
    : (typeof verification.latitude === "number"
      ? verification.latitude
      : null);
  const verifiedLng = verification.skipped
    ? null
    : (typeof verification.longitude === "number"
      ? verification.longitude
      : null);

  const listing = await getListingById(listingId);
  if (!listing || !listing.published) {
    return NextResponse.json(
      { error: "That listing isn't available right now." },
      { status: 404 }
    );
  }
  const boiUser = await getUserById(listing.user_id);
  const application = await getApplicationByUserId(listing.user_id);
  if (
    !boiUser ||
    boiUser.subscription_status !== "active" ||
    !application ||
    application.status !== "approved"
  ) {
    return NextResponse.json(
      { error: "That boi isn't bookable right now." },
      { status: 409 }
    );
  }

  // The price comes from pricing.ts only — never from the request body.
  // The 20/80 split is derived from the same price at the same time.
  const amountCents = priceForService(service);
  const split = splitAmount(service);

  try {
    const booking = await createBooking(randomUUID(), {
      client_user_id: user.id,
      boi_user_id: listing.user_id,
      listing_id: listing.id,
      service,
      amount_cents: amountCents,
      company_amount_cents: split.company,
      cleaner_amount_cents: split.cleaner,
      date,
      time_slot: timeSlot,
      frequency,
      service_address: verifiedAddress,
      place_id: verifiedPlaceId,
      latitude: verifiedLat,
      longitude: verifiedLng,
      supplies_by_homeowner: suppliesByHomeowner,
      notes,
      payment_provider: paymentProvider,
    });

    const details = {
      serviceLabel: serviceLabel(service),
      amount: formatCents(amountCents),
      cleanerAmount: formatCents(split.cleaner),
      date,
      timeLabel: timeSlotLabel(timeSlot),
      frequencyLabel: frequencyLabel(frequency),
      address: verifiedAddress,
      suppliesByHomeowner,
      notes,
    };
    // Emails run after the response goes out and never break the booking
    // if Resend isn't set up. (Boi/homeowner mail only delivers once a
    // domain is verified in Resend — see src/lib/notify.ts.)
    const sendBookingEmails = () =>
      after(() => {
        void notifyNewBooking({
          clientEmail: user.email,
          boiName: listing.display_name,
          bookingId: booking.id,
          ...details,
        });
        void notifyBoiNewBooking({
          boiEmail: boiUser.email,
          clientEmail: user.email,
          boiName: listing.display_name,
          ...details,
        });
      });

    // PayPal: create the order now; the homeowner approves and pays it
    // in the PayPal button on the booking page, and the capture route
    // marks the booking paid. No redirect to PayPal's site.
    if (paymentProvider === "paypal") {
      const order = await createPayPalOrder(amountCents, {
        bookingId: booking.id,
        description: `${serviceLabel(service)} — AZ House Bois · ${listing.display_name} · ${date} at ${timeSlotLabel(timeSlot)}`,
      });
      await setBookingPayPalOrder(booking.id, order.id);
      sendBookingEmails();
      return NextResponse.json({
        paypal_order_id: order.id,
        booking_id: booking.id,
      });
    }

    const stripe = getStripe();
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id, role: "client" },
      });
      customerId = customer.id;
      await updateUserStripe(user.id, { stripe_customer_id: customerId });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://az-house-bois.vercel.app";
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `${serviceLabel(service)} — AZ House Bois`,
              description: `${listing.display_name} · ${date} at ${timeSlotLabel(timeSlot)}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard?booked=1`,
      cancel_url: `${appUrl}/book/${listing.id}?cancelled=1`,
      metadata: { type: "booking", booking_id: booking.id, user_id: user.id },
      payment_intent_data: {
        metadata: { type: "booking", booking_id: booking.id },
      },
    });

    await setBookingCheckoutSession(booking.id, checkout.id);

    sendBookingEmails();

    return NextResponse.json({ url: checkout.url, booking_id: booking.id });
  } catch (err) {
    console.error("booking error", err);
    return NextResponse.json(
      { error: "Could not start the booking. Please try again." },
      { status: 500 }
    );
  }
}
