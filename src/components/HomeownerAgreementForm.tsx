"use client";

import { useState } from "react";
import { HOMEOWNER_AGREEMENT_TEXT } from "@/lib/homeowner-agreement";

/**
 * The agreement text + checkbox + typed signature, controlled by the parent.
 * Used on the signup page (homeowners sign as they create the account).
 */
export function HomeownerAgreementBlock({
  agreed,
  setAgreed,
  signature,
  setSignature,
}: {
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  signature: string;
  setSignature: (v: string) => void;
}) {
  return (
    <>
      <h3 style={{ marginTop: 28 }}>Homeowner agreement &amp; waiver</h3>
      <div
        className="card"
        style={{
          background: "var(--surface2)",
          maxHeight: 320,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          fontSize: "0.95rem",
        }}
      >
        {HOMEOWNER_AGREEMENT_TEXT}
      </div>
      <label
        style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16 }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ width: "auto", marginTop: 4 }}
        />
        <span>
          I have read the homeowner agreement &amp; waiver above and I agree
          to all of it.
        </span>
      </label>
      <label htmlFor="homeowner_signature">Type your full name to sign</label>
      <input
        id="homeowner_signature"
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        required
        autoComplete="off"
        placeholder="Your full name"
      />
      <p className="small muted">
        Signed today,{" "}
        {new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        .
      </p>
    </>
  );
}

/**
 * Standalone sign form for homeowners who created their account before the
 * agreement existed. Posts to /api/homeowner-agreement and reloads on
 * success so the dashboard shows the signed status.
 */
export default function HomeownerAgreementSignForm() {
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/homeowner-agreement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature, agreed }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not save your signature.");
      setBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={submit}>
      <HomeownerAgreementBlock
        agreed={agreed}
        setAgreed={setAgreed}
        signature={signature}
        setSignature={setSignature}
      />
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        className="btn btn-brand"
        disabled={busy}
        style={{ width: "100%", marginTop: 20 }}
      >
        {busy ? "Saving your signature…" : "Sign the agreement"}
      </button>
    </form>
  );
}
