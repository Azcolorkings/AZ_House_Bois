"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (res?.error) {
      setError("Email or password didn't match. Try again.");
      setBusy(false);
      return;
    }
    window.location.href = next;
  }

  return (
    <form onSubmit={submit} className="card">
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      {error && <div className="error" role="alert">{error}</div>}
      <button type="submit" className="btn btn-brand" disabled={busy} style={{ width: "100%", marginTop: 20 }}>
        {busy ? "Logging in…" : "Log in"}
      </button>
      <p className="small" style={{ marginTop: 16 }}>
        No account yet? <Link href="/signup">Create one</Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 520 }}>
        <h2>Log in</h2>
        <p className="muted">Members only — log in to browse the roster or manage your listing.</p>
        <div style={{ marginTop: 20 }}>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
