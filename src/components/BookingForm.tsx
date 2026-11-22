"use client";

import { useEffect, useState } from "react";
import PayPalButton from "@/components/PayPalButton";
import {
  CLEANING_PRICES,
  SERVICE_LABELS,
  SERVICE_KEYS,
  FREQUENCY_LABELS,
  FREQUENCY_KEYS,
  TIME_SLOTS,
  formatCents,
  type ServiceKey,
  type FrequencyKey,
} from "@/lib/pricing";

function todayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function BookingForm({ listingId }: { listingId: string }) {
  const [service, setService] = useState<ServiceKey>("regular");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("10:00");
  const [frequency, setFrequency] = useState<FrequencyKey>("one-time");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [supplies, setSupplies] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"stripe" | "paypal">("stripe");
  const [paypalReady, setPaypalReady] = useState(false);
  // Set once the booking is created with PayPal — the PayPal button
  // below then captures this order. Until then the form is the step.
  const [paypalOrder, setPaypalOrder] = useState<{
    orderId: string;
    bookingId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/paypal/config")
      .then((r) => r.json())
      .then((cfg: { configured?: boolean }) => {
        if (!cancelled) setPaypalReady(Boolean(cfg?.configured));
      })
      .catch(() => {
        if (!cancelled) setPaypalReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function capturePayPalOrder(orderId: string, bookingId: string) {
    const res = await fetch("/api/paypal/orders/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, bookingId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      throw new Error(data?.error || "Could not capture the PayPal payment.");
    }
    window.location.href = "/dashboard?booked=1";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          service,
          date,
          time_slot: timeSlot,
          frequency,
          service_address: address,
          supplies_by_homeowner: supplies,
          notes,
          payment_provider: method,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = `/login?next=/book/${listingId}`;
        return;
      }
      if (!res.ok) {
        setError(data?.error || "Could not start the booking.");
        setBusy(false);
        return;
      }
      if (data?.paypal_order_id && data?.booking_id) {
        // PayPal: the booking is saved (unpaid). The PayPal button
        // below approves and captures this order — same amount, same
        // booking. Nothing is charged until the capture completes.
        setPaypalOrder({
          orderId: data.paypal_order_id,
          bookingId: data.booking_id,
        });
        setBusy(false);
        return;
      }
      if (data?.url) {
        // Stripe Checkout (one-time payment). After paying, the homeowner
        // lands back on the dashboard.
        window.location.href = data.url;
        return;
      }
      setError("Could not start checkout. Please try again.");
      setBusy(false);
    } catch {
      setError("Could not start the booking. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label>Service — flat rate, same price any house size</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
        {SERVICE_KEYS.map((key) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 400,
              border: "1px solid var(--border, #ddd)",
              borderRadius: 12,
              padding: "12px 14px",
              cursor: "pointer",
            }}
          >
            <input
              type="radio"
              name="service"
              value={key}
              checked={service === key}
              onChange={() => setService(key)}
              style={{ width: "auto" }}
            />
            <span style={{ flex: 1 }}>
              <strong>{SERVICE_LABELS[key]}</strong>
              {key === "regular" && (
                <span className="muted small"> — full regular clean: kitchen, bathrooms, living &amp; bedrooms</span>
              )}
              {key === "deep" && (
                <span className="muted small"> — everything in a regular clean, plus built-up grime, baseboards &amp; fixtures</span>
              )}
              {key === "moveout" && (
                <span className="muted small"> — empty-home clean, inside cabinets &amp; appliances</span>
              )}
            </span>
            <strong>{formatCents(CLEANING_PRICES[key])}</strong>
          </label>
        ))}
      </div>

      <label htmlFor="date">Date</label>
      <input
        id="date"
        type="date"
        min={todayIso()}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />

      <label htmlFor="time_slot">Time</label>
      <select
        id="time_slot"
        value={timeSlot}
        onChange={(e) => setTimeSlot(e.target.value)}
      >
        {TIME_SLOTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <label htmlFor="frequency">How often</label>
      <select
        id="frequency"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value as FrequencyKey)}
      >
        {FREQUENCY_KEYS.map((f) => (
          <option key={f} value={f}>
            {FREQUENCY_LABELS[f]}
          </option>
        ))}
      </select>
      <p className="small muted" style={{ marginTop: 4 }}>
        This payment covers this one clean only. A recurring schedule just
        means the same boi comes back — each visit is booked and paid
        separately.
      </p>

      <label htmlFor="service_address">Address for the clean</label>
      <input
        id="service_address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
        placeholder="Street address, city, ZIP"
      />

      <label htmlFor="notes">Notes for your boi (optional)</label>
      <textarea
        id="notes"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Gate code, pets, anything he should know before he arrives."
      />

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontWeight: 400 }}>
        <input
          type="checkbox"
          checked={supplies}
          onChange={(e) => setSupplies(e.target.checked)}
          style={{ width: "auto", marginTop: 4 }}
        />
        <span>
          <strong>I have my own cleaning supplies</strong>
          <br />
          <span className="small muted">
            Check this only if you&apos;ll have your own cleaning products
            ready for him. Otherwise your boi brings his own supplies.
          </span>
        </span>
      </label>

      <div
        className="card"
        style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>
          <strong>{SERVICE_LABELS[service]}</strong>
          <br />
          <span className="small muted">
            {date || "Pick a date"} ·{" "}
            {TIME_SLOTS.find((s) => s.value === timeSlot)?.label} ·{" "}
            {FREQUENCY_LABELS[frequency]}
          </span>
        </span>
        <span style={{ fontSize: "1.6rem", fontWeight: 900 }}>
          {formatCents(CLEANING_PRICES[service])}
        </span>
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        You pay now, through AZ House Bois — never directly to the cleaner.
        Your boi confirms the booking from his dashboard. If he
        declines, or you cancel before he confirms, you get refunded.
      </p>

      <label>How do you want to pay?</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 400,
            border: "1px solid var(--border, #ddd)",
            borderRadius: 12,
            padding: "12px 14px",
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="payment_method"
            value="stripe"
            checked={method === "stripe"}
            onChange={() => setMethod("stripe")}
            disabled={Boolean(paypalOrder)}
            style={{ width: "auto" }}
          />
          <span>
            <strong>Card</strong>
            <br />
            <span className="small muted">Pay by card at checkout (Stripe).</span>
          </span>
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 400,
            border: "1px solid var(--border, #ddd)",
            borderRadius: 12,
            padding: "12px 14px",
            cursor: paypalReady ? "pointer" : "not-allowed",
            opacity: paypalReady ? 1 : 0.6,
          }}
        >
          <input
            type="radio"
            name="payment_method"
            value="paypal"
            checked={method === "paypal"}
            onChange={() => setMethod("paypal")}
            disabled={!paypalReady || Boolean(paypalOrder)}
            style={{ width: "auto" }}
          />
          <span>
            <strong>PayPal</strong>
            <br />
            <span className="small muted">
              {paypalReady
                ? "Pay with your PayPal account."
                : "PayPal checkout isn't set up yet."}
            </span>
          </span>
        </label>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {paypalOrder ? (
        <div style={{ marginTop: 12 }}>
          <p className="small muted">
            Your booking is saved. Complete the payment with PayPal below —
            nothing is charged until you approve it there.
          </p>
          <PayPalButton
            intent="capture"
            create={async () => paypalOrder.orderId}
            onApprove={async (data) => {
              if (!data.orderID) {
                throw new Error("PayPal didn't return an order.");
              }
              await capturePayPalOrder(data.orderID, paypalOrder.bookingId);
            }}
          />
        </div>
      ) : (
        <button
          type="submit"
          className="btn btn-brand"
          disabled={busy}
          style={{ marginTop: 12 }}
        >
          {busy
            ? "Starting checkout…"
            : method === "paypal"
              ? `Continue with PayPal — ${formatCents(CLEANING_PRICES[service])}`
              : `Pay ${formatCents(CLEANING_PRICES[service])} and book →`}
        </button>
      )}
    </form>
  );
}
