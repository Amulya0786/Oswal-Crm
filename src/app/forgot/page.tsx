"use client";

import { useState } from "react";

export default function ForgotPage() {
  const [done, setDone] = useState(false);
  return (
    <main className="login-wrap">
      <form className="login-card stack" onSubmit={async (event) => {
        event.preventDefault();
        const email = new FormData(event.currentTarget).get("email");
        await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        setDone(true);
      }}>
        <h1>Reset password</h1>
        <label className="stack">Email<input name="email" type="email" required /></label>
        <button className="btn">Send reset link</button>
        {done && <p>If that account exists, a reset link is on its way.</p>}
      </form>
    </main>
  );
}
