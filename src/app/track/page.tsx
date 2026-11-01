"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/chrome";

export default function TrackPage() {
  const [step, setStep] = useState<"ask" | "otp" | "done">("ask");
  const [ticket, setTicket] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  return (
    <main className="main" style={{ maxWidth: 640 }}>
      <BrandLogo />
      <h1 style={{ fontFamily: "var(--display)" }}>Track a complaint</h1>
      {step === "ask" && (
        <form className="stack" onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/public/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketNo: ticket, phone }) });
          const body = await response.json();
          if (!response.ok) setError(body.error);
          else { setDevCode(body.devCode ?? ""); setStep("otp"); setError(""); }
        }}>
          <input placeholder="Comp. No" value={ticket} onChange={(event) => setTicket(event.target.value)} required />
          <input placeholder="Mobile" value={phone} onChange={(event) => setPhone(event.target.value)} required />
          <button className="btn">Send OTP</button>
        </form>
      )}
      {step === "otp" && (
        <form className="stack" onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/public/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketNo: ticket, phone, code }) });
          const body = await response.json();
          if (!response.ok) setError(body.error);
          else { setResult(body); setStep("done"); }
        }}>
          {devCode && <div className="banner">Demo OTP: {devCode}. SMS is not configured.</div>}
          <input placeholder="OTP" value={code} onChange={(event) => setCode(event.target.value)} required />
          <button className="btn">Show status</button>
        </form>
      )}
      {result && (
        <section className="panel" style={{ borderTop: `4px solid ${result.accent}` }}>
          <p className="kicker">{result.legalName}</p>
          <h2 className="mono">{result.ticketNo}</h2>
          <p>{result.status} · {result.callType}</p>
          <p>{result.customerName}</p>
          <ul className="timeline">{result.events.map((event: any, index: number) => <li key={index}>{event.message}</li>)}</ul>
        </section>
      )}
      {error && <div className="banner bad">{error}</div>}
    </main>
  );
}
