import { NextResponse } from "next/server";
import {
  isPayPalConfigured,
  paypalClientId,
  planConfigured,
  PAYPAL_PLAN_CLIENT,
  PAYPAL_PLAN_BOI,
} from "@/lib/paypal";

/**
 * Public PayPal config for the JS SDK buttons. Returns the public
 * client ID and whether PayPal is actually usable — NEVER the secret.
 * The client hides/disables the PayPal button when configured is false.
 */
export async function GET() {
  return NextResponse.json({
    configured: isPayPalConfigured() && Boolean(paypalClientId()),
    clientId: paypalClientId(),
    // Subscriptions need billing plans on top of the API credentials;
    // one-time booking payments only need the credentials.
    plansConfigured:
      planConfigured(PAYPAL_PLAN_CLIENT) && planConfigured(PAYPAL_PLAN_BOI),
  });
}
