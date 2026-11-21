"use client";

import { useState } from "react";

export interface AdminApplicationView {
  id: string;
  email: string;
  legal_name: string;
  dob: string;
  address: string;
  phone: string;
  ssn: string;
  ssn_masked: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  experience: string;
  availability: string;
  service_areas: string;
  photo_data: string | null;
  id_upload_data: string | null;
  agreement_text: string;
  agreement_signature: string;
  agreement_signed_at: string;
  status: "pending" | "approved" | "denied";
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtSsn(ssn: string): string {
  const d = ssn.replace(/\D/g, "");
  if (d.length !== 9) return ssn || "—";
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

export default function AdminApplicationList({
  applications,
}: {
  applications: AdminApplicationView[];
}) {
  const [items, setItems] = useState(applications);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function review(id: string, action: "approve" | "deny") {
    setBusyId(id);
    setError("");
    const res = await fetch("/api/admin/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not update the application.");
      setBusyId(null);
      return;
    }
    setItems((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: action === "approve" ? "approved" : "denied",
              reviewed_at: new Date().toISOString(),
            }
          : a
      )
    );
    setBusyId(null);
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <p className="muted">No applications yet.</p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {items.map((a) => (
        <article key={a.id} className="card" style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <h3 style={{ margin: 0 }}>{a.legal_name}</h3>
            <span
              className="pill"
              style={{
                background:
                  a.status === "approved"
                    ? "#e6f4ea"
                    : a.status === "denied"
                      ? "#fdeceb"
                      : "var(--surface2)",
              }}
            >
              {a.status.toUpperCase()}
            </span>
          </div>
          <p className="small muted" style={{ marginTop: 6 }}>
            {a.email} · applied {fmtDate(a.created_at)}
            {a.reviewed_at ? ` · reviewed ${fmtDate(a.reviewed_at)}` : ""}
          </p>

          <div className="grid-2" style={{ gap: 8 }}>
            <div>
              <p>
                <strong>Date of birth:</strong>{" "}
                {a.dob ? fmtDate(a.dob + "T00:00:00") : "—"}
              </p>
              <p>
                <strong>Address:</strong> {a.address}
              </p>
              <p>
                <strong>Phone:</strong> {a.phone}
              </p>
              <p>
                <strong>SSN:</strong> {fmtSsn(a.ssn)}
              </p>
            </div>
            <div>
              <p>
                <strong>Emergency contact:</strong> {a.emergency_contact_name}{" "}
                — {a.emergency_contact_phone}
              </p>
              <p>
                <strong>Availability:</strong> {a.availability}
              </p>
              <p>
                <strong>Service areas:</strong> {a.service_areas}
              </p>
            </div>
          </div>

          <p>
            <strong>Experience:</strong> {a.experience}
          </p>

          <div
            style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}
          >
            {a.photo_data && (
              <figure style={{ margin: 0 }}>
                <figcaption className="small muted">Profile photo</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.photo_data}
                  alt={`Profile photo of ${a.legal_name}`}
                  style={{ maxWidth: 160, borderRadius: 12 }}
                />
              </figure>
            )}
            {a.id_upload_data && (
              <figure style={{ margin: 0 }}>
                <figcaption className="small muted">ID upload</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.id_upload_data}
                  alt={`ID of ${a.legal_name}`}
                  style={{ maxWidth: 240, borderRadius: 12 }}
                />
              </figure>
            )}
          </div>

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>
              Signed agreement — {a.agreement_signature},{" "}
              {fmtDate(a.agreement_signed_at)}
            </summary>
            <div
              style={{
                background: "var(--surface2)",
                borderRadius: 12,
                padding: 16,
                marginTop: 8,
                whiteSpace: "pre-wrap",
                fontSize: "0.9rem",
              }}
            >
              {a.agreement_text}
            </div>
          </details>

          {a.status === "pending" && (
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-teal"
                disabled={busyId === a.id}
                onClick={() => review(a.id, "approve")}
              >
                {busyId === a.id ? "Saving…" : "Approve"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === a.id}
                onClick={() => review(a.id, "deny")}
              >
                {busyId === a.id ? "Saving…" : "Deny"}
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
