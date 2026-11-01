"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/chrome";

export default function PasswordPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="login-shell">
      <div className="login-bg" />
      <div className="login-bg-2" />
      <div className="login-shade" />
      <section className="login-card">
        <form className="stack" onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          const data = new FormData(event.currentTarget);
          const response = await fetch("/api/auth/password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current: data.get("current"), password: data.get("password") }),
          });
          const body = await response.json();
          setPending(false);
          if (!response.ok) {
            setError(body.error ?? "Could not change the password");
            return;
          }
          window.location.href = "/";
        }}>
          <BrandLogo />
          <p className="kicker">First sign-in</p>
          <h2>Choose your password</h2>
          <p className="muted">The password from the deploy form works once. After this, only the new one signs you in.</p>
          <label className="stack">Current password<input name="current" type="password" autoComplete="current-password" required /></label>
          <label className="stack">New password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
          {error && <div className="banner bad">{error}</div>}
          <button className="btn" disabled={pending}>{pending ? "Saving…" : "Save and enter the desk"}</button>
        </form>
      </section>
    </div>
  );
}
