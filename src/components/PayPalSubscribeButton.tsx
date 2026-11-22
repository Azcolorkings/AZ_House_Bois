"use client";

import PayPalButton from "@/components/PayPalButton";

/**
 * PayPal alternative to the Stripe SubscribeButton: the buyer approves
 * the $20/month subscription in the PayPal popup, then the confirm
 * route verifies it server-side before the membership activates.
 * Renders nothing but a muted note when PayPal isn't configured.
 */
export default function PayPalSubscribeButton({
  role,
}: {
  role: "client" | "boi";
}) {
  async function createSubscription(): Promise<string> {
    const res = await fetch("/api/paypal/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = (await res.json()) as {
      subscriptionId?: string;
      error?: string;
    };
    if (res.status === 401) {
      window.location.href = `/login?next=/pricing&role=${role}`;
      throw new Error("Sign in first.");
    }
    if (!res.ok || !data?.subscriptionId) {
      throw new Error(data?.error || "Could not start PayPal checkout.");
    }
    return data.subscriptionId;
  }

  async function onApprove(data: { subscriptionID?: string }) {
    if (!data.subscriptionID) {
      throw new Error("PayPal didn't return a subscription.");
    }
    const res = await fetch("/api/paypal/subscriptions/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscriptionId: data.subscriptionID }),
    });
    const result = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(
        result?.error || "Could not confirm the PayPal subscription."
      );
    }
    window.location.href = "/dashboard?subscribed=1";
  }

  return (
    <PayPalButton
      intent="subscription"
      create={createSubscription}
      onApprove={onApprove}
    />
  );
}
