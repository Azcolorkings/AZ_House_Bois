"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";
import Link from "next/link";

/**
 * Admin-only sign-in form. Same credentials auth as the regular
 * /login page, but after signing in it checks server-side whether
 * the email is the admin email. Non-admins are signed straight
 * back out with a plain error — they never reach the admin pages.
 * No sign-up link, no role picker, no boi registration anywhere here.
 */
export default function AdminLoginForm() {
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
    const check = await fetch("/api/admin/me");
    const data = await check.json().catch(() => ({ isAdmin: false }));
    if (data?.isAdmin) {
      window.location.href = "/admin";
      return;
    }
    await signOut({ redirect: false });
    setError("This login is for the site admin only.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="card">
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="current-password"
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
        {busy ? "Logging in…" : "Log in as admin"}
      </button>
      <p className="small muted" style={{ marginTop: 16 }}>
        Not the site admin?{" "}
        <Link href="/login">Go to the regular log in page</Link>
      </p>
    </form>
  );
}
