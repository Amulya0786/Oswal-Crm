"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/chrome";

const showDemo = process.env.NEXT_PUBLIC_DEMO_HINTS === "1";
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
      body: JSON.stringify({ email: formData.get("email"), password: formData.get("password"), totp: formData.get("totp") }),
    });
    setPending(false);
    const body = await response.json();
    if (body.needsTotp) {
      setError("Enter the 6-digit authenticator code");
      return;
    }
    if (body.setupTotp) {
      window.location.href = `/totp?user=${body.userId}`;
      return;
    }
    if (!response.ok) {
      setError(body.error ?? "Could not sign in");
      return;
    }
    if (body.mustChangePassword) {
      window.location.href = "/password";
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.href = next;
  }
  return (
    <div className="login-shell">
      <div className="login-bg" />
      <div className="login-bg-2" />
      <div className="login-shade" />
      <section className="login-card">
        <form action={onSubmit} className="stack">
          <BrandLogo />
          <p className="kicker">Oswal Pumps Ltd · Karnal, Haryana</p>
          <h2>Service desk</h2>
          <label className="stack">Email<input name="email" type="email" autoComplete="username" required defaultValue={showDemo ? "admin@oswal.test" : ""} /></label>
          <label className="stack">Password<input name="password" type="password" autoComplete="current-password" required defaultValue={showDemo ? "Admin@123" : ""} /></label>
          <label className="stack">Authenticator code<input name="totp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></label>
          <a href="/forgot">Forgot password</a>
          <a href="/book">Register a complaint</a>
          {error && <div className="banner bad">{error}</div>}
          <button className="btn" disabled={pending}>{pending ? "Signing in…" : "Enter the desk"}</button>
          {showDemo && (
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
