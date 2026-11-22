"use client";

import { useState } from "react";
import type { AdminUserRow } from "@/lib/db";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function AccountCard({
  account,
  onToggle,
  busy,
}: {
  account: AdminUserRow;
  onToggle: (id: string, suspended: boolean) => void;
  busy: boolean;
}) {
  return (
    <article className="card" style={{ margin: 0 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <strong>{account.email}</strong>
          {account.display_name && (
            <span className="muted"> · {account.display_name}</span>
          )}
        </div>
        <span
          className="pill"
          style={
            account.suspended
              ? { background: "#fdeceb", fontWeight: 800 }
              : undefined
          }
        >
          {account.suspended ? "SUSPENDED" : "active"}
        </span>
      </div>
      <p className="small muted" style={{ margin: "8px 0" }}>
        Joined {fmtDate(account.created_at)} · Membership:{" "}
        <strong>{account.subscription_status}</strong>
        {account.role === "client" && (
          <>
            {" · "}Agreement:{" "}
            <strong>
              {account.homeowner_agreement_signed ? "signed ✓" : "not signed"}
            </strong>
          </>
        )}
        {account.role === "boi" && (
          <>
            {" · "}Application:{" "}
            <strong>{account.application_status ?? "none"}</strong>
            {" · "}Listing:{" "}
            <strong>
              {account.listing_published ? "published ✓" : "not published"}
            </strong>
          </>
        )}
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={busy}
        onClick={() => onToggle(account.id, !account.suspended)}
      >
        {busy ? "Saving…" : account.suspended ? "Unsuspend" : "Suspend"}
      </button>
      {account.suspended && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Suspended — this account cannot sign in or use the site until you
          turn it back on. Nothing was deleted.
        </p>
      )}
    </article>
  );
}

export default function AdminUserList({
  users,
}: {
  users: AdminUserRow[];
}) {
  const [items, setItems] = useState(users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(id: string, suspended: boolean) {
    setBusyId(id);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, suspended }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not update the account.");
      setBusyId(null);
      return;
    }
    setItems((prev) =>
      prev.map((u) => (u.id === id ? { ...u, suspended } : u))
    );
    setBusyId(null);
  }

  const clients = items.filter((u) => u.role === "client");
  const bois = items.filter((u) => u.role === "boi");

  return (
    <div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <h3 style={{ marginTop: 28 }}>
        Clients (homeowners) — {clients.length}
      </h3>
      {clients.length === 0 ? (
        <div className="card">
          <p className="muted">No homeowner accounts yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {clients.map((u) => (
            <AccountCard
              key={u.id}
              account={u}
              onToggle={toggle}
              busy={busyId === u.id}
            />
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 28 }}>Bois — {bois.length}</h3>
      {bois.length === 0 ? (
        <div className="card">
          <p className="muted">No boi accounts yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {bois.map((u) => (
            <AccountCard
              key={u.id}
              account={u}
              onToggle={toggle}
              busy={busyId === u.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
