"use client";

import { useState } from "react";

const DEMOS = [
  ["Admin", "admin@oswalpumps.local", "Admin@123"],
  ["Call centre", "callcentre@oswalpumps.local", "Call@123"],
  ["Area manager", "am.karnal@oswalpumps.local", "Area@123"],
  ["State head", "sh.haryana@oswalpumps.local", "State@123"],
  ["Technician", "tech.karnal@oswalpumps.local", "Tech@123"],
  ["Dealer", "dealer.karnal@oswalpumps.local", "Dealer@123"],
];

export function LoginForm() {
  const [email, setEmail] = useState("admin@oswalpumps.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not sign in.");
      setPending(false);
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 lg:hidden">
        <div className="font-display text-2xl font-semibold text-navy">Oswal Pumps</div>
        <div className="text-xs font-semibold tracking-[0.18em] text-muted">SERVICE CRM</div>
      </div>
      <h2 className="font-display text-2xl font-semibold text-navy">Sign in</h2>
      <p className="mt-1 text-sm text-muted">Use your desk login. Sessions last 12 hours.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input className="field" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <button className="btn btn-accent w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="mt-8 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Demo access</div>
        <div className="mt-2 space-y-1 text-sm">
          {DEMOS.map(([role, demoEmail, demoPassword]) => (
            <button
              key={demoEmail}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
              onClick={() => {
                setEmail(demoEmail);
                setPassword(demoPassword);
              }}
            >
              <span className="font-medium text-navy">{role}</span>
              <span className="text-xs text-muted">{demoEmail}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Remove this panel before go-live.</p>
      </div>
    </div>
  );
}
