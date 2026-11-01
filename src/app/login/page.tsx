"use client";

import { useState } from "react";
import { Mark } from "@/components/shell";

const DEMOS = [["Admin", "admin@oswal.test", "Admin@123"]];

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email"), password: formData.get("password") }),
    });
    setPending(false);
    if (!response.ok) {
      const body = await response.json();
      setError(body.error ?? "Could not sign in");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.href = next;
  }
  return (
    <div className="login-shell">
      <section className="login-hero">
        <div>
          <Mark size={52} />
          <h1>Oswal Service</h1>
          <p>The complaint desk for Oswal Pumps and Oswal Solar. Book, assign and close a call without the old screens.</p>
        </div>
        <p>Karnal · Haryana</p>
      </section>
      <section className="login-card">
        <form action={onSubmit} className="stack">
          <p className="kicker">Sign in</p>
          <h2 style={{ fontFamily: "var(--display)", margin: 0 }}>Welcome back</h2>
          <label className="stack">Email<input name="email" type="email" autoComplete="username" required defaultValue="admin@oswal.test" /></label>
          <label className="stack">Password<input name="password" type="password" autoComplete="current-password" required defaultValue="Admin@123" /></label>
          {error && <div className="banner bad">{error}</div>}
          <button className="btn" disabled={pending}>{pending ? "Signing in…" : "Enter the desk"}</button>
          {process.env.NEXT_PUBLIC_DEMO_HINTS !== "0" && (
            <table>
              <tbody>
                {DEMOS.map((row) => (
                  <tr key={row[1]}><td>{row[0]}</td><td className="mono">{row[1]}</td><td className="mono">{row[2]}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </form>
      </section>
    </div>
  );
}
