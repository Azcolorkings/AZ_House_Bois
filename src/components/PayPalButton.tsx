"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders a PayPal button from the PayPal JS SDK (loaded from
 * paypal.com — no npm dependency). Two modes:
 *   "subscription" — vault + intent=subscription; create() returns a
 *     PayPal subscription id, onApprove gets { subscriptionID }.
 *   "capture" — intent=capture; create() returns a PayPal order id,
 *     onApprove gets { orderID }.
 *
 * Fail-soft by design: when PayPal isn't configured (/api/paypal/config
 * says so) the button is replaced with a plain muted message instead
 * of breaking the page. The secret never reaches the browser — only
 * the public client ID comes back from the config route.
 *
 * Note: the SDK can only load once per page with one intent. Pricing
 * and dashboard pages only ever render subscription buttons, and the
 * booking page only ever renders capture buttons, so the two intents
 * never collide on the same page.
 */

interface PayPalApproveData {
  subscriptionID?: string;
  orderID?: string;
}

interface PayPalButtonsConfig {
  style?: {
    layout?: "vertical" | "horizontal";
    color?: "gold" | "blue" | "silver" | "white" | "black";
    shape?: "rect" | "pill";
    label?: "paypal" | "checkout" | "buynow" | "pay" | "subscribe";
  };
  createSubscription?: () => Promise<string>;
  createOrder?: () => Promise<string>;
  onApprove?: (data: PayPalApproveData) => Promise<void>;
  onError?: (err: unknown) => void;
  onCancel?: () => void;
}

interface PayPalNamespace {
  Buttons: (config: PayPalButtonsConfig) => { render: (el: HTMLElement) => void };
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

const sdkPromises = new Map<string, Promise<boolean>>();

function loadPayPalSdk(
  clientId: string,
  intent: "subscription" | "capture"
): Promise<boolean> {
  const params =
    intent === "subscription"
      ? `client-id=${encodeURIComponent(clientId)}&currency=USD&intent=subscription&vault=true`
      : `client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
  const src = `https://www.paypal.com/sdk/js?${params}`;
  if (!sdkPromises.has(src)) {
    sdkPromises.set(
      src,
      new Promise((resolve) => {
        if (typeof window !== "undefined" && window.paypal) {
          resolve(true);
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => resolve(Boolean(window.paypal));
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      })
    );
  }
  return sdkPromises.get(src) as Promise<boolean>;
}

export default function PayPalButton({
  intent,
  create,
  onApprove,
}: {
  intent: "subscription" | "capture";
  /** Returns the PayPal subscription id (subscription mode) or order id (capture mode). */
  create: () => Promise<string>;
  onApprove: (data: PayPalApproveData) => Promise<void>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const createRef = useRef(create);
  const onApproveRef = useRef(onApprove);
  createRef.current = create;
  onApproveRef.current = onApprove;
  const renderedRef = useRef(false);
  const [status, setStatus] = useState<
    "loading" | "ready" | "unavailable" | "error"
  >("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/paypal/config");
        const cfg = (await res.json()) as {
          configured?: boolean;
          clientId?: string | null;
          plansConfigured?: boolean;
        };
        if (!cfg?.configured || !cfg?.clientId) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        if (intent === "subscription" && !cfg?.plansConfigured) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        const ok = await loadPayPalSdk(cfg.clientId, intent);
        if (!ok || !window.paypal) {
          if (!cancelled) setStatus("error");
          return;
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intent]);

  useEffect(() => {
    if (status !== "ready" || renderedRef.current) return;
    const el = containerRef.current;
    if (!el || !window.paypal) return;
    renderedRef.current = true;
    window.paypal
      .Buttons({
        style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal" },
        ...(intent === "subscription"
          ? { createSubscription: () => createRef.current() }
          : { createOrder: () => createRef.current() }),
        onApprove: async (data) => {
          try {
            await onApproveRef.current(data);
          } catch (err) {
            setMessage(
              err instanceof Error
                ? err.message
                : "PayPal couldn't finish that. Please try again."
            );
          }
        },
        onError: (err) => {
          console.error("paypal button error", err);
          setMessage(
            "PayPal checkout hit an error. Please try again, or pay with a card."
          );
        },
      })
      .render(el);
  }, [status, intent]);

  if (status === "unavailable") {
    return (
      <p className="small muted" style={{ marginTop: 8 }}>
        PayPal checkout isn&apos;t set up yet.
      </p>
    );
  }
  if (status === "error") {
    return (
      <div className="error" role="alert">
        PayPal couldn&apos;t load. Please try again, or pay with a card.
      </div>
    );
  }
  return (
    <div>
      {status === "loading" && (
        <p className="small muted">Loading PayPal…</p>
      )}
      <div ref={containerRef} />
      {message && (
        <div className="error" role="alert">
          {message}
        </div>
      )}
    </div>
  );
}
