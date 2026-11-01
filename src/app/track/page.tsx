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
      <h1>Track a complaint</h1>
      {step === "ask" && (
        <form className="stack" onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/public/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketNo: ticket, phone }) });
          const body = await response.json();
          if (!response.ok) setError(body.error);
          else { setDevCode(body.devCode ?? ""); setStep("otp"); setError(""); }
        }}>
          <label className="stack">Complaint number<input value={ticket} maxLength={20} onChange={(event) => setTicket(event.target.value)} required /></label>
          <label className="stack">Mobile<input value={phone} inputMode="numeric" maxLength={10} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required /></label>
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
          {devCode && process.env.NEXT_PUBLIC_SHOW_DEV_OTP === "1" && <div className="banner">Demo OTP: {devCode}</div>}
          <label className="stack">OTP<input value={code} inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
          <button className="btn">Show status</button>
        </form>
      )}
      {result && (
        <section className="panel" style={{ borderTop: `4px solid ${result.accent}` }}>
          <p className="kicker">{result.legalName}</p>
          <h2 className="mono">{result.ticketNo}</h2>
          <p>{result.status} · {result.callType}</p>
          <p>Technician: {result.technicianFirst ?? "Not assigned yet"}</p>
          <p>Expected visit: {result.scheduleDate ? new Date(result.scheduleDate).toLocaleDateString("en-IN") : "Not scheduled yet"}</p>
          <p>{result.feedbackPending ? "You can rate this visit from 1 to 5 on WhatsApp." : result.happyRating ? `Rated ${result.happyRating}/5` : "A rating opens after the visit is closed."}</p>
          <ul className="timeline">{result.events.map((event: any, index: number) => <li key={index}>{event.message}</li>)}</ul>
        </section>
      )}
      {error && <div className="banner bad">{error}</div>}
    </main>
  );
}
