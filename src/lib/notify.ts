import { Resend } from "resend";

/**
 * Email notifications to the site admin (Steven) when someone signs up or
 * applies. Deliberately fail-soft: if RESEND_API_KEY is not set, or the
 * send fails for any reason, we log and return — a notification must NEVER
 * break a signup or an application.
 *
 * Setup (see DEPLOY.md): free Resend account on stevendrice2992@gmail.com,
 * API key in RESEND_API_KEY. Until the key is set, the app works exactly
 * as before and nothing is sent.
 *
 * The sender is Resend's free-tier onboarding address. It only works when
 * the recipient is the Resend account owner's own email, which is why the
 * default recipient is Steven's Gmail.
 */

const ADMIN_URL = "https://az-house-bois.vercel.app/admin/applications";

function getRecipient(): string {
  return (process.env.NOTIFY_EMAIL || "stevendrice2992@gmail.com").trim();
}

/** Send one admin email. Never throws. Returns true when Resend accepted it. */
export async function sendAdminNotification(
  subject: string,
  text: string
): Promise<boolean> {
  return sendEmail(getRecipient(), subject, text);
}

/**
 * Send one email to any address. Never throws. Returns true when Resend
 * accepted it.
 *
 * Free-tier limit to know about: Resend's free tier only delivers mail
 * sent from onboarding@resend.dev to the Resend account owner's own
 * email. Admin mail to Steven works today. Mail to a boi or a homeowner
 * will be rejected by Resend until a domain is verified in Resend and
 * the `from` below is changed to it — the failure is logged and the
 * booking still succeeds, exactly like every other notification here.
 */
export async function sendEmail(
  to: string,
  subject: string,
  text: string
): Promise<boolean> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return false;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "AZ House Bois <onboarding@resend.dev>",
      to,
      subject,
      text,
    });
    if (error) {
      console.error("email notification failed", { to, error });
      return false;
    }
    return true;
  } catch (err) {
    console.error("email notification failed", { to, err });
    return false;
  }
}

export interface BookingEmailDetails {
  serviceLabel: string;
  amount: string;
  /** The cleaner's 80% share — shown to the boi and to Steven. */
  cleanerAmount?: string;
  date: string;
  timeLabel: string;
  frequencyLabel: string;
  address: string;
  suppliesByHomeowner: boolean;
  notes: string;
}

/** A homeowner just booked (and paid for) a clean. Tells Steven. */
export async function notifyNewBooking(data: {
  clientEmail: string;
  boiName: string;
  bookingId: string;
} & BookingEmailDetails): Promise<boolean> {
  const text = [
    "A homeowner just booked a clean.",
    "",
    `Homeowner: ${data.clientEmail}`,
    `Boi: ${data.boiName}`,
    `Service: ${data.serviceLabel} — ${data.amount}`,
    data.cleanerAmount
      ? `Split: company keeps 20%, cleaner gets ${data.cleanerAmount} (80%).`
      : "",
    `When: ${data.date} at ${data.timeLabel}`,
    `Frequency: ${data.frequencyLabel}`,
    `Address: ${data.address}`,
    `Supplies: ${data.suppliesByHomeowner ? "Homeowner has their own supplies" : "Boi brings their own supplies"}`,
    data.notes ? `Notes: ${data.notes}` : "",
    "",
    `All bookings: https://az-house-bois.vercel.app/admin/bookings`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return sendAdminNotification(
    `New booking — ${data.boiName}, ${data.serviceLabel} ${data.date}`,
    text
  );
}

/** A homeowner just booked you — sent to the boi. */
export async function notifyBoiNewBooking(data: {
  boiEmail: string;
  clientEmail: string;
  boiName: string;
} & BookingEmailDetails): Promise<boolean> {
  const text = [
    `Hi ${data.boiName}, a homeowner just booked you on AZ House Bois.`,
    "",
    `Service: ${data.serviceLabel} — ${data.amount}`,
    data.cleanerAmount
      ? `Your pay for this clean: ${data.cleanerAmount} (80% of the fee, paid biweekly after AZ House Bois gets paid).`
      : "",
    `When: ${data.date} at ${data.timeLabel}`,
    `Frequency: ${data.frequencyLabel}`,
    `Address: ${data.address}`,
    `Supplies: ${data.suppliesByHomeowner ? "The homeowner has their own supplies" : "Bring your own cleaning supplies"}`,
    data.notes ? `Notes: ${data.notes}` : "",
    "",
    "The clean is already paid for. Accept or decline it from your dashboard — if you decline, the homeowner gets refunded.",
    "",
    `Your dashboard: https://az-house-bois.vercel.app/dashboard`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return sendEmail(
    data.boiEmail,
    `New booking — ${data.serviceLabel} on ${data.date}`,
    text
  );
}

/** A booking was confirmed, declined, or cancelled — sent to the homeowner. */
export async function notifyHomeownerBookingUpdate(data: {
  clientEmail: string;
  boiName: string;
  status: "confirmed" | "declined" | "cancelled";
  refunded: boolean;
} & BookingEmailDetails): Promise<boolean> {
  const statusLine =
    data.status === "confirmed"
      ? `${data.boiName} confirmed your clean — you're all set.`
      : data.status === "declined"
        ? `${data.boiName} couldn't take this clean, so it was declined.`
        : "Your clean was cancelled.";
  const refundLine =
    data.status === "confirmed"
      ? ""
      : data.refunded
        ? "Your payment was refunded — it should be back on your card within a few business days."
        : "If you already paid, a refund is being handled by AZ House Bois — you'll hear from us if anything is needed.";
  const text = [
    statusLine,
    "",
    `Service: ${data.serviceLabel} — ${data.amount}`,
    `When: ${data.date} at ${data.timeLabel}`,
    `Boi: ${data.boiName}`,
    refundLine,
    "",
    `Your dashboard: https://az-house-bois.vercel.app/dashboard`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  const subject =
    data.status === "confirmed"
      ? `Your clean is confirmed — ${data.serviceLabel} on ${data.date}`
      : data.status === "declined"
        ? `Your booking was declined — ${data.serviceLabel} on ${data.date}`
        : `Your booking was cancelled — ${data.serviceLabel} on ${data.date}`;
  return sendEmail(data.clientEmail, subject, text);
}

/** A cleaner just submitted (or re-submitted) their application. */
export async function notifyNewApplication(data: {
  legalName: string;
  email: string;
  phone: string;
  serviceAreas: string;
}): Promise<boolean> {
  const text = [
    "A new cleaner application is waiting for review.",
    "",
    `Name: ${data.legalName}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Service areas: ${data.serviceAreas}`,
    "",
    `Review it here: ${ADMIN_URL}`,
  ].join("\n");
  return sendAdminNotification(
    `New cleaner application — ${data.legalName}`,
    text
  );
}

/** A new account was just created (homeowner or cleaner). */
export async function notifyNewSignup(data: {
  email: string;
  role: "client" | "boi";
}): Promise<boolean> {
  const who = data.role === "client" ? "Homeowner" : "Cleaner (boi)";
  const text = [
    `A new ${who.toLowerCase()} account was just created on AZ House Bois.`,
    "",
    `Email: ${data.email}`,
    `Role: ${who}`,
    data.role === "boi"
      ? "They still need to fill out the cleaner application before they can pay or list."
      : "They signed the homeowner agreement at signup and can subscribe now.",
    "",
    `Cleaner applications: ${ADMIN_URL}`,
  ].join("\n");
  return sendAdminNotification(
    `New AZ House Bois signup — ${data.email} (${who})`,
    text
  );
}
