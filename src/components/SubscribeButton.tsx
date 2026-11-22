"use client";

import { useState } from "react";
import PayPalSubscribeButton from "@/components/PayPalSubscribeButton";

export default function SubscribeButton({
  role,
  label,
  className = "btn btn-brand",
}: {
  role: "client" | "boi";
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = `/login?next=/pricing&role=${role}`;
        return;
      }
      if (!res.ok) {
        setError(data?.error || "Could not start checkout.");
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className={className} onClick={go} disabled={busy}>
        {busy ? "Starting checkout…" : label}
      </button>
      {error && <div className="error" role="alert">{error}</div>}
      <div style={{ marginTop: 12 }}>
        <p className="small muted" style={{ margin: "0 0 8px" }}>
          Or pay with PayPal — same $20/month:
        </p>
        <PayPalSubscribeButton role={role} />
      </div>
    </span>
  );
}
