"use client";

import { useEffect, useState } from "react";

export default function TotpPage() {
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [qr, setQr] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const userId = new URLSearchParams(window.location.search).get("user");
    if (!userId) return;
    void fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) })
      .then((response) => response.json())
      .then(async (body) => {
        setSecret(body.secret ?? "");
        setUri(body.uri ?? "");
        if (body.uri) {
          const QR = await import("qrcode");
          setQr(await QR.toDataURL(body.uri, { margin: 1, width: 220 }));
        }
      });
  }, []);
  return (
    <main className="login-wrap">
      <form className="login-card stack" onSubmit={async (event) => {
        event.preventDefault();
        const userId = new URLSearchParams(window.location.search).get("user");
        const code = new FormData(event.currentTarget).get("code");
        const response = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, secret, code }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) { setMessage(body.error ?? "Could not confirm"); return; }
        window.location.href = "/";
      }}>
        <h1>Authenticator</h1>
        <p>Scan this code, then enter the 6-digit number.</p>
        {qr ? <img src={qr} alt="Authenticator QR code" width={220} height={220} /> : <p>Preparing the code…</p>}
        <p className="mono">{secret}</p>
        {uri && <p className="muted">{uri}</p>}
        <label className="stack">Code<input name="code" inputMode="numeric" aria-label="Authenticator code" required /></label>
        <button className="btn">Confirm and open the desk</button>
        {message && <p>{message}</p>}
      </form>
    </main>
  );
}
