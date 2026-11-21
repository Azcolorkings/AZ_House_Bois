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
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return false;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: "AZ House Bois <onboarding@resend.dev>",
      to: getRecipient(),
      subject,
      text,
    });
    if (error) {
      console.error("admin notification failed", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("admin notification failed", err);
    return false;
  }
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
