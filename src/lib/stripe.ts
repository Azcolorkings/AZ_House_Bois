import Stripe from "stripe";

export const CLIENT_PRICE_ID =
  process.env.STRIPE_PRICE_CLIENT || "price_CLIENT_PLACEHOLDER";
export const BOI_PRICE_ID =
  process.env.STRIPE_PRICE_BOI || "price_BOI_PLACEHOLDER";

export const SUBSCRIPTION_PRICE = 20; // $20/month, both sides

/** True only once the real live price IDs are configured. */
export function priceConfigured(priceId: string): boolean {
  return Boolean(priceId) && !priceId.includes("PLACEHOLDER");
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });
  }
  return stripeClient;
}

export function priceIdForRole(role: "client" | "boi"): string {
  return role === "client" ? CLIENT_PRICE_ID : BOI_PRICE_ID;
}
