"use client";

import { useState } from "react";

export function ProfileAuthenticator({ enabled }: { enabled: boolean }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  if (enabled) return <p>Authenticator is on. Sign-in asks for the 6-digit code as well as the password.</p>;
  return (
    <form className="stack" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setError("");
      const response = await fetch("/api/auth/totp/start", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPending(false);
        setError(body.error ?? "Could not start the authenticator");
        return;
      }
      window.location.href = "/totp";
    }}>
      <p>Authenticator is off. Sign-in uses email and password. Turn it on only if you want a code from your phone.</p>
      {error && <div className="banner bad">{error}</div>}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Starting…" : "Turn on authenticator"}</button>
    </form>
  );
}
