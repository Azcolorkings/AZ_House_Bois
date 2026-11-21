"use client";

import { useState } from "react";
import Link from "next/link";

export interface BookingView {
  id: string;
  service_label: string;
  amount: string;
  /** The cleaner's 80% share — shown to the boi. */
  cleaner_amount: string;
  /** The company's 20% share — shown to the admin. */
  company_amount: string;
  date: string;
  time_label: string;
  frequency_label: string;
  address: string;
  supplies_by_homeowner: boolean;
  notes: string;
  status: "requested" | "confirmed" | "declined" | "completed" | "cancelled";
  paid: boolean;
  refund_status: "none" | "not_required" | "refunded" | "failed";
  needs_refund: boolean;
  client_email: string;
  boi_display_name: string;
  boi_city: string;
  created_at: string;
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusText(b: BookingView, view: "boi" | "client"): string {
  if (b.status === "requested" && !b.paid) return "Payment not completed";
  if (b.status === "requested")
    return view === "boi" ? "New request" : "Paid — waiting for your boi to confirm";
  if (b.status === "confirmed") return "Confirmed";
  if (b.status === "declined") return "Declined";
  if (b.status === "completed") return "Completed";
  return "Cancelled";
}

export default function BookingList({
  bookings,
  view,
}: {
  bookings: BookingView[];
  view: "boi" | "client";
}) {
  const [items, setItems] = useState(bookings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function act(
    id: string,
    action: "confirm" | "decline" | "cancel"
  ) {
    setBusyId(id);
    setError("");
    setNotice("");
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not update the booking.");
      setBusyId(null);
      return;
    }
    setItems((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              status: data.status as BookingView["status"],
              refund_status:
                data.refunded === true
                  ? "refunded"
                  : b.refund_status,
              needs_refund:
                data.status === "cancelled" && data.refunded === false && b.paid
                  ? true
                  : b.needs_refund,
            }
          : b
      )
    );
    if (action === "decline") {
      setNotice(
        data.refunded
          ? "Declined — the homeowner was refunded."
          : "Declined. The refund couldn't go through automatically, so it's flagged for the site owner to refund by hand."
      );
    } else if (action === "cancel") {
      setNotice(
        data.note
          ? `Cancelled. ${data.note}`
          : data.refunded
            ? "Cancelled — your payment was refunded."
            : "Cancelled."
      );
    } else {
      setNotice("Confirmed — the homeowner has been emailed.");
    }
    setBusyId(null);
  }

  if (items.length === 0) {
    return (
      <p className="muted">
        {view === "boi"
          ? "No bookings yet. Once a homeowner books you, their request shows up here."
          : "No bookings yet. Browse the roster and book your first clean."}
      </p>
    );
  }

  return (
    <div>
      {notice && (
        <div className="success" role="status" style={{ marginBottom: 12 }}>
          {notice}
        </div>
      )}
      {error && (
        <div className="error" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((b) => (
          <div
            key={b.id}
            className="card"
            style={{ margin: 0, border: "1px solid var(--border, #e5e5e5)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>
                  {b.service_label} — {b.amount}
                </strong>{" "}
                <span className="pill">{statusText(b, view)}</span>
                {view === "boi" && (
                  <span className="small muted"> · your pay: {b.cleaner_amount}</span>
                )}
              </div>
              <span className="small muted">{fmtDate(b.date)} · {b.time_label}</span>
            </div>
            <p className="small" style={{ margin: "8px 0" }}>
              {view === "boi" ? (
                <>Homeowner: <strong>{b.client_email}</strong></>
              ) : (
                <>Boi: <strong>{b.boi_display_name}</strong> · {b.boi_city}</>
              )}
              <br />
              {b.frequency_label} · {b.address}
              <br />
              Supplies:{" "}
              {b.supplies_by_homeowner
                ? "Homeowner has their own supplies"
                : "Boi brings their own supplies"}
              {b.notes && (
                <>
                  <br />
                  Notes: {b.notes}
                </>
              )}
              {b.status === "declined" && b.paid && (
                <>
                  <br />
                  Refund:{" "}
                  {b.refund_status === "refunded"
                    ? "refunded ✓"
                    : b.refund_status === "failed"
                      ? "refund failed — flagged for the site owner to handle"
                      : "pending"}
                </>
              )}
              {b.status === "cancelled" && b.needs_refund && (
                <>
                  <br />
                  Refund: being handled manually by AZ House Bois.
                </>
              )}
            </p>
            {view === "boi" && b.status === "requested" && b.paid && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-teal"
                  disabled={busyId === b.id}
                  onClick={() => act(b.id, "confirm")}
                >
                  {busyId === b.id ? "Working…" : "Accept"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === b.id}
                  onClick={() => act(b.id, "decline")}
                >
                  Decline
                </button>
              </div>
            )}
            {view === "client" &&
              (b.status === "requested" || b.status === "confirmed") && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === b.id}
                    onClick={() => act(b.id, "cancel")}
                  >
                    {busyId === b.id ? "Working…" : "Cancel booking"}
                  </button>
                  {b.status === "requested" && !b.paid && (
                    <Link href="/roster" className="btn btn-brand">
                      Book again →
                    </Link>
                  )}
                </div>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
