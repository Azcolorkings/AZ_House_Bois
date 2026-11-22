/**
 * PayPal — server-side REST helpers (no SDK dependency; plain fetch).
 * Mirrors src/lib/stripe.ts: env-driven, throws only when called without
 * credentials, and never exposes the client secret to the browser.
 *
 * PayPal is ADDITIVE — Stripe stays untouched and is still the default.
 * Env vars (see .env.example):
 *   PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET — REST API app credentials.
 *   PAYPAL_MODE — "live" or "sandbox" (defaults to sandbox).
 *   PAYPAL_PLAN_CLIENT / PAYPAL_PLAN_BOI — $20/month billing plan IDs,
 *     created in the PayPal Business dashboard. Placeholders keep
 *     subscriptions disabled with a clear message until real plans exist.
 *   PAYPAL_WEBHOOK_ID — from the webhook endpoint in the PayPal
 *     developer dashboard (optional; without it the webhook verifies
 *     events by fetching the resource from PayPal instead).
 *   NEXT_PUBLIC_PAYPAL_CLIENT_ID — public client ID for the JS SDK; falls
 *     back to PAYPAL_CLIENT_ID via /api/paypal/config.
 */

export const PAYPAL_PLAN_CLIENT =
  process.env.PAYPAL_PLAN_CLIENT || "plan_CLIENT_PLACEHOLDER";
export const PAYPAL_PLAN_BOI =
  process.env.PAYPAL_PLAN_BOI || "plan_BOI_PLACEHOLDER";

export const SUBSCRIPTION_PRICE = 20; // $20/month, both sides

const LIVE_BASE = "https://api-m.paypal.com";
const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

/** "live" only when explicitly set — anything else is the sandbox. */
export function paypalMode(): "live" | "sandbox" {
  return process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
}

function paypalBase(): string {
  return paypalMode() === "live" ? LIVE_BASE : SANDBOX_BASE;
}

/** True only once the REST API credentials are configured. */
export function isPayPalConfigured(): boolean {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET
  );
}

/** The public client ID the JS SDK needs — never the secret. */
export function paypalClientId(): string | null {
  return (
    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
    process.env.PAYPAL_CLIENT_ID ||
    null
  );
}

/** True only once a real billing plan ID is configured. */
export function planConfigured(planId: string): boolean {
  return Boolean(planId) && !planId.includes("PLACEHOLDER");
}

export function planIdForRole(role: "client" | "boi"): string {
  return role === "client" ? PAYPAL_PLAN_CLIENT : PAYPAL_PLAN_BOI;
}

// --- OAuth2 access token (client-credentials grant, cached in memory) ---

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getPayPalAccessToken(): Promise<string> {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured");
  }
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal token request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new Error("PayPal token request returned no access token");
  }
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function paypalFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = await getPayPalAccessToken();
  const res = await fetch(`${paypalBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal ${path} failed (${res.status}): ${text}`);
  }
  return (await res.json()) as T;
}

// --- Types (only the fields this app reads) ---

export interface PayPalSubscription {
  id: string;
  status: string;
  plan_id?: string;
  custom_id?: string;
  billing_info?: { next_billing_time?: string };
  links?: { rel?: string; href?: string }[];
}

export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount?: { currency_code?: string; value?: string };
      }[];
    };
  }[];
}

export interface PayPalCapture {
  id: string;
  status: string;
  amount?: { currency_code?: string; value?: string };
  supplementary_data?: { related_ids?: { order_id?: string } };
}

// --- Subscriptions ($20/month, Subscriptions API) ---

/**
 * custom_id carries who this subscription belongs to, in the same role
 * as Stripe's metadata: "userId|role|founding" where founding is 1 when
 * the boi is using one of the 5 founding free months. PayPal echoes it
 * back on the subscription and in webhook events.
 */
export function paypalSubscriptionCustomId(
  userId: string,
  role: "client" | "boi",
  foundingFree: boolean
): string {
  return `${userId}|${role}|${foundingFree ? "1" : "0"}`;
}

export function parsePayPalCustomId(
  customId: string | undefined | null
): { userId: string; role: string; foundingFree: boolean } | null {
  if (!customId) return null;
  const parts = customId.split("|");
  if (parts.length !== 3 || !parts[0]) return null;
  return { userId: parts[0], role: parts[1], foundingFree: parts[2] === "1" };
}

/**
 * Create a subscription. The buyer approves it in the PayPal popup
 * (JS SDK) or on PayPal's site; it only becomes ACTIVE after approval.
 *
 * Founding offer (boi only): PayPal has no coupon system, so the free
 * first month is a per-subscription billing-cycle override — a 1-month
 * $0 TRIAL cycle, then the regular $20/month cycle. The plan itself
 * stays a plain $20/month plan; the override applies only to this
 * subscription. The founding_free_used flag is still only marked once
 * the subscription activates (confirm route / webhook), never here.
 */
export async function createPayPalSubscription(
  planId: string,
  opts: { customId: string; foundingFree: boolean }
): Promise<PayPalSubscription> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://az-house-bois.vercel.app";
  const body: Record<string, unknown> = {
    plan_id: planId,
    custom_id: opts.customId,
    application_context: {
      brand_name: "AZ House Bois",
      user_action: "SUBSCRIBE_NOW",
      return_url: `${appUrl}/dashboard?subscribed=1`,
      cancel_url: `${appUrl}/pricing?cancelled=1`,
    },
  };
  if (opts.foundingFree) {
    body.plan = {
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "TRIAL",
          sequence: 1,
          total_cycles: 1,
          pricing_scheme: {
            fixed_price: { value: "0", currency_code: "USD" },
          },
        },
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 2,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: "20", currency_code: "USD" },
          },
        },
      ],
    };
  }
  return paypalFetch<PayPalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getPayPalSubscription(
  subscriptionId: string
): Promise<PayPalSubscription> {
  return paypalFetch<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`
  );
}

// --- One-time orders (Orders API, booking payments) ---

export async function createPayPalOrder(
  amountCents: number,
  opts: { bookingId: string; description: string }
): Promise<PayPalOrder> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://az-house-bois.vercel.app";
  return paypalFetch<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.bookingId,
          custom_id: opts.bookingId,
          description: opts.description,
          amount: {
            currency_code: "USD",
            value: (amountCents / 100).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: "AZ House Bois",
        return_url: `${appUrl}/dashboard?booked=1`,
        cancel_url: `${appUrl}/dashboard`,
      },
    }),
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`
  );
}

export async function capturePayPalOrder(
  orderId: string
): Promise<PayPalOrder> {
  return paypalFetch<PayPalOrder>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    { method: "POST", body: "{}" }
  );
}

export async function getPayPalCapture(
  captureId: string
): Promise<PayPalCapture> {
  return paypalFetch<PayPalCapture>(
    `/v2/payments/captures/${encodeURIComponent(captureId)}`
  );
}

/** Refund a captured booking payment. Never throws — callers flag it. */
export async function refundPayPalCapture(
  captureId: string,
  amountCents?: number
): Promise<unknown> {
  const body =
    typeof amountCents === "number"
      ? {
          amount: {
            currency_code: "USD",
            value: (amountCents / 100).toFixed(2),
          },
        }
      : {};
  return paypalFetch(
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

// --- Webhook signature verification ---

/**
 * Verify a PayPal webhook delivery against the webhook ID from the
 * developer dashboard. Returns false when no webhook ID is configured —
 * callers then verify the event by fetching the referenced resource
 * from PayPal before trusting it (never trust an unverified payload).
 */
export async function verifyPayPalWebhookSignature(
  headers: {
    transmissionId: string | null;
    transmissionTime: string | null;
    transmissionSig: string | null;
    certUrl: string | null;
    authAlgo: string | null;
  },
  webhookEvent: unknown
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  if (
    !headers.transmissionId ||
    !headers.transmissionTime ||
    !headers.transmissionSig ||
    !headers.certUrl ||
    !headers.authAlgo
  ) {
    return false;
  }
  try {
    const result = await paypalFetch<{ verification_status?: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo: headers.authAlgo,
          cert_url: headers.certUrl,
          transmission_id: headers.transmissionId,
          transmission_sig: headers.transmissionSig,
          transmission_time: headers.transmissionTime,
          webhook_id: webhookId,
          webhook_event: webhookEvent,
        }),
      }
    );
    return result.verification_status === "SUCCESS";
  } catch (err) {
    console.error("paypal webhook verification failed", err);
    return false;
  }
}
