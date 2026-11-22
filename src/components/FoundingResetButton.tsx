"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Reopen all 5 founding spots" — admin-only button on the /admin
 * dashboard. Clears founding_free_used for every user via
 * POST /api/admin/founding-reset, so the 5 first-month-free spots are
 * available again. Two-click confirm, since it changes who gets the
 * free month.
 */
export default function FoundingResetButton({
  spotsLeft,
}: {
  spotsLeft: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function reset() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/founding-reset", {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not reopen the founding spots.");
      setBusy(false);
      setConfirming(false);
      return;
    }
    setDone(true);
    setBusy(false);
    setConfirming(false);
    // Re-render the server component so the founding card (and the rest
    // of Analytics) shows the fresh count from the database.
    router.refresh();
  }

  return (
    <div style={{ marginTop: 8 }}>
      <p className="small muted" style={{ margin: "0 0 8px", lineHeight: 1.8 }}>
        {/* Always show the live count from the server (refreshed after a
            reset) rather than assuming 5 — the number must match the DB. */}
        {spotsLeft} of 5 founding spots left
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={busy || done}
        style={
          confirming ? { background: "#fdeceb", color: "#8f1d1d" } : undefined
        }
        onClick={() => {
          if (confirming) {
            void reset();
          } else {
            setConfirming(true);
          }
        }}
      >
        {busy
          ? "Reopening…"
          : done
            ? "All 5 founding spots are open"
            : confirming
              ? "Click again to reopen all 5 spots"
              : "Reopen all 5 founding spots"}
      </button>
      {error && (
        <p className="small" role="alert" style={{ color: "#8f1d1d", marginTop: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
