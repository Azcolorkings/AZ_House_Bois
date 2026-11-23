"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  onDelete,
  onComp,
  busy,
  deleting,
  comping,
}: {
  account: AdminUserRow;
  onToggle: (id: string, suspended: boolean) => void;
  onDelete: (id: string) => void;
  onComp: (id: string, grant: boolean) => void;
  busy: boolean;
  deleting: boolean;
  comping: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmingComp, setConfirmingComp] = useState(false);
  const isComp = account.payment_provider === "comp";
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
        {isComp && (
          <>
            {" · "}
            <strong>Comp (free)</strong>
          </>
        )}
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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || deleting}
          onClick={() => onToggle(account.id, !account.suspended)}
        >
          {busy ? "Saving…" : account.suspended ? "Unsuspend" : "Suspend"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || deleting || comping}
          style={
            confirmingComp
              ? { background: "#eef4ff", color: "#1d4ed8" }
              : undefined
          }
          onClick={() => {
            if (confirmingComp) {
              onComp(account.id, !isComp);
              setConfirmingComp(false);
            } else {
              setConfirmingComp(true);
            }
          }}
        >
          {comping
            ? "Saving…"
            : confirmingComp
              ? isComp
                ? "Click again to remove the free subscription"
                : "Click again to give a free subscription"
              : isComp
                ? "Remove comp"
                : "Comp free"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || deleting}
          style={
            confirming ? { background: "#fdeceb", color: "#8f1d1d" } : undefined
          }
          onClick={() => {
            if (confirming) {
              onDelete(account.id);
              setConfirming(false);
            } else {
              setConfirming(true);
            }
          }}
        >
          {deleting
            ? "Deleting…"
            : confirming
              ? "Click again to delete — this is permanent"
              : "Delete"}
        </button>
      </div>
      {isComp && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Complimentary subscription — free, no Stripe or PayPal charge.
          The account can browse the roster and book like a paying
          subscriber.
        </p>
      )}
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
  const router = useRouter();
  const [items, setItems] = useState(users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [compingId, setCompingId] = useState<string | null>(null);
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
    // Re-render the server component so the Analytics counts (suspended,
    // paying) match the database instead of showing the old numbers.
    router.refresh();
  }

  async function comp(id: string, grant: boolean) {
    setCompingId(id);
    setError("");
    const res = await fetch("/api/admin/comp-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, comp: grant }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not update the comp subscription.");
      setCompingId(null);
      return;
    }
    setItems((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              subscription_status: data?.subscription_status ?? u.subscription_status,
              payment_provider: data?.payment_provider ?? null,
            }
          : u
      )
    );
    setCompingId(null);
    // Re-render the server component so the Analytics counts
    // (subscriptions) match the database instead of showing the old
    // numbers.
    router.refresh();
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError("");
    const res = await fetch("/api/admin/users/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not delete the account.");
      setDeletingId(null);
      return;
    }
    setItems((prev) => prev.filter((u) => u.id !== id));
    setDeletingId(null);
    // Re-render the server component so the Analytics counts (total
    // accounts, clients vs bois, signups, subscriptions, listings,
    // bookings, founding spots, 14-day signups) match the database
    // instead of showing the old numbers.
    router.refresh();
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

      <h3 id="clients" style={{ marginTop: 28 }}>
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
              onDelete={remove}
              onComp={comp}
              busy={busyId === u.id}
              deleting={deletingId === u.id}
              comping={compingId === u.id}
            />
          ))}
        </div>
      )}

      <h3 id="bois" style={{ marginTop: 28 }}>Bois — {bois.length}</h3>
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
              onDelete={remove}
              onComp={comp}
              busy={busyId === u.id}
              deleting={deletingId === u.id}
              comping={compingId === u.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
