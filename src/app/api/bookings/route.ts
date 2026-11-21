import { NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import {
  createBooking,
  getApplicationByUserId,
  getListingById,
  getUserById,
  hasSignedHomeownerAgreement,
  setBookingCheckoutSession,
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create a booking and start a one-time Stripe Checkout for it.
 * The amount is ALWAYS re-derived from src/lib/pricing.ts — a
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
      service_address: serviceAddress,
      supplies_by_homeowner: suppliesByHomeowner,
      notes,
    });

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

    const details = {
      serviceLabel: serviceLabel(service),
      amount: formatCents(amountCents),
      cleanerAmount: formatCents(split.cleaner),
      date,
      timeLabel: timeSlotLabel(timeSlot),
      frequencyLabel: frequencyLabel(frequency),
      address: serviceAddress,
      suppliesByHomeowner,
      notes,
    };
    // Emails run after the response goes out and never break the booking
    // if Resend isn't set up. (Boi/homeowner mail only delivers once a
    // domain is verified in Resend — see src/lib/notify.ts.)
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

    return NextResponse.json({ url: checkout.url, booking_id: booking.id });
  } catch (err) {
    console.error("booking error", err);
    return NextResponse.json(
      { error: "Could not start the booking. Please try again." },
      { status: 500 }
    );
  }
}
