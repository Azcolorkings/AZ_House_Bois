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

/**
 * The live ("active") subscription for a Stripe customer, if one
 * exists. Used to heal a user row whose subscription status went stale
 * — e.g. the Nov 22 webhook bug that stored a Checkout Session's
 * "complete" status instead of "active", leaving a paying boi unable
 * to reach the listing editor. Returns null when the customer has no
 * active subscription. Never throws for a missing customer; Stripe
 * errors propagate to the caller, which must fail soft.
 */
export async function getLiveSubscriptionForCustomer(customerId: string): Promise<{
  id: string;
  status: string;
  current_period_end: string | null;
} | null> {
  const stripe = getStripe();
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });
  const sub = subs.data[0];
  if (!sub) return null;
  // In this Stripe API version the period end lives on the
  // subscription item, not on the subscription itself.
  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  return {
    id: sub.id,
    status: sub.status,
    current_period_end: periodEnd
      ? new Date(periodEnd * 1000).toISOString()
      : null,
  };
}
