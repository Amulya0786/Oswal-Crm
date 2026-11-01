"use client";

import { useEffect, useState } from "react";

export default function TotpPage() {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get("user");
    if (!userId) return;
    void fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
      .then((response) => response.json())
      .then((body) => setSecret(body.secret ?? ""));
  }, []);
  return (
    <main className="login-wrap">
      <form className="login-card stack" onSubmit={async (event) => {
        event.preventDefault();
        const userId = new URLSearchParams(window.location.search).get("user");
        const code = new FormData(event.currentTarget).get("code");
        const response = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, secret, code }) });
        const body = await response.json();
        setMessage(response.ok ? "Authenticator saved. Sign in with the code." : body.error);
      }}>
        <h1>Authenticator</h1>
        <p>Add this secret to an authenticator app, then enter the code.</p>
        <p className="mono">{secret}</p>
        <label className="stack">Code<input name="code" inputMode="numeric" required /></label>
        <button className="btn">Confirm</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
