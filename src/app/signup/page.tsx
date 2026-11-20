"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function SignupForm() {
  const params = useSearchParams();
  const initialRole = params.get("role") === "boi" ? "boi" : "client";
  const [role, setRole] = useState<"client" | "boi">(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not create the account.");
      setBusy(false);
      return;
    }
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (login?.error) {
      window.location.href = "/login";
      return;
    }
    window.location.href = "/pricing";
  }

  return (
    <form onSubmit={submit} className="card">
      <label>Which side are you on?</label>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          className="look-chip"
          aria-pressed={role === "client"}
          onClick={() => setRole("client")}
        >
          🏠 I&apos;m a Homeowner
        </button>
        <button
          type="button"
          className="look-chip"
          aria-pressed={role === "boi"}
          onClick={() => setRole("boi")}
        >
          🔥 I&apos;m a Boi
        </button>
      </div>
      <p className="small muted">
        {role === "client"
          ? "Homeowners subscribe for $20/month to browse the roster and book bois."
          : "Bois subscribe for $20/month to post their profile and get booked."}
      </p>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
      <p className="small muted">At least 8 characters. 18+ only.</p>
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn btn-brand" disabled={busy} style={{ width: "100%", marginTop: 20 }}>
        {busy ? "Creating your account…" : "Create my account"}
      </button>
      <p className="small" style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <h2>Join AZ House Bois</h2>
        <p className="muted">Create your account, then subscribe — $20/month on either side.</p>
        <div style={{ marginTop: 20 }}>
          <Suspense>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
