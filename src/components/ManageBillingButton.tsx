"use client";

import { useState } from "react";

export default function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Could not open the billing portal.");
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch {
      setError("Could not open the billing portal. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button type="button" className="btn btn-ghost" onClick={go} disabled={busy}>
        {busy ? "Opening…" : "Manage / cancel subscription"}
      </button>
      {error && <div className="error" role="alert">{error}</div>}
    </span>
  );
}
