"use client";

import { useState } from "react";

export default function ResetPage() {
  const [message, setMessage] = useState("");
  return (
    <main className="login-wrap">
      <form className="login-card stack" onSubmit={async (event) => {
        event.preventDefault();
        const password = String(new FormData(event.currentTarget).get("password") ?? "");
        const token = new URLSearchParams(window.location.search).get("token");
        const response = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
        const body = await response.json();
        setMessage(response.ok ? "Password updated. You can sign in." : body.error);
      }}>
        <h1>New password</h1>
        <label className="stack">Password<input name="password" type="password" minLength={8} required /></label>
        <button className="btn">Save</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
