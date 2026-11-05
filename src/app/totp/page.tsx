"use client";

import { useEffect, useState } from "react";

export default function TotpPage() {
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    void fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(body.error ?? "Sign in again to set up the authenticator");
          return;
        }
        setSecret(body.secret ?? "");
        if (body.uri) {
          const QR = await import("qrcode");
          setQr(await QR.toDataURL(body.uri, { margin: 1, width: 220 }));
        }
      })
      .catch(() => setMessage("Could not load the authenticator code"));
  }, []);
  return (
    <main className="login-wrap">
      <form className="login-card stack" onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        const code = new FormData(event.currentTarget).get("code");
        const response = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        const body = await response.json().catch(() => ({}));
        setPending(false);
        if (!response.ok) { setMessage(body.error ?? "Could not confirm"); return; }
        window.location.href = "/";
      }}>
        <h1>Authenticator</h1>
        <p>Scan this code, or type the secret into your app, then enter the 6-digit number.</p>
        {qr ? <img src={qr} alt="Authenticator QR code" width={220} height={220} /> : <p>{message || "Preparing the code…"}</p>}
        {secret && <p className="mono">{secret}</p>}
        <label className="stack">Code<input name="code" inputMode="numeric" aria-label="Authenticator code" autoComplete="one-time-code" required /></label>
        <button className="btn" disabled={pending}>{pending ? "Checking…" : "Confirm and open the desk"}</button>
        {message && qr && <p>{message}</p>}
      </form>
    </main>
  );
}
