"use client";

import { useState } from "react";
import { BrandLogo } from "@/components/chrome";

const COPY = {
  en: { title: "Track a complaint", ticket: "Complaint number", mobile: "Mobile", send: "Send OTP", otp: "OTP", show: "Show status", tech: "Technician", visit: "Expected visit", none: "Not assigned yet", unscheduled: "Not scheduled yet", lang: "हिंदी" },
  hi: { title: "शिकायत देखें", ticket: "शिकायत संख्या", mobile: "मोबाइल", send: "कोड भेजें", otp: "कोड", show: "स्थिति देखें", tech: "तकनीशियन", visit: "संभावित विज़िट", none: "अभी तय नहीं", unscheduled: "अभी निर्धारित नहीं", lang: "English" },
};

export default function TrackPage() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const t = COPY[lang];
  const [step, setStep] = useState<"ask" | "otp" | "done">("ask");
  const [ticket, setTicket] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  return (
    <main className="main public-shell" style={{ maxWidth: 640 }}>
      <BrandLogo />
      <button type="button" className="btn line" onClick={() => setLang(lang === "en" ? "hi" : "en")}>{t.lang}</button>
      <h1>{t.title}</h1>
      {step === "ask" && (
        <form className="stack" onSubmit={async (event) => {
          event.preventDefault();
          const response = await fetch("/api/public/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketNo: ticket, phone }) });
          const body = await response.json();
          if (!response.ok) setError(body.error);
          else { setDevCode(body.devCode ?? ""); setStep("otp"); setError(""); }
        }}>
          <label className="stack">{t.ticket}<input aria-label={t.ticket} value={ticket} maxLength={20} onChange={(event) => setTicket(event.target.value)} required /></label>
          <label className="stack">{t.mobile}<input aria-label={t.mobile} value={phone} inputMode="numeric" maxLength={10} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} required /></label>
          <button className="btn">{t.send}</button>
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
          <label className="stack">{t.otp}<input aria-label={t.otp} value={code} inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
          <button className="btn">{t.show}</button>
        </form>
      )}
      {result && (
        <section className="panel" style={{ borderTop: `4px solid ${result.accent}` }}>
          <p className="kicker">{result.legalName}</p>
          <h2 className="mono">{result.ticketNo}</h2>
          <p>{result.status} · {result.callType}</p>
          <p>{t.tech}: {result.technicianFirst ?? t.none}</p>
          <p>{t.visit}: {result.scheduleDate ? new Date(result.scheduleDate).toLocaleDateString("en-IN") : t.unscheduled}</p>
          <p>{result.feedbackPending ? "You can rate this visit from 1 to 5 on WhatsApp." : result.happyRating ? `Rated ${result.happyRating}/5` : "A rating opens after the visit is closed."}</p>
          <ul className="timeline">{result.events.map((event: any, index: number) => <li key={index}>{event.message}</li>)}</ul>
        </section>
      )}
      {error && <div className="banner bad">{error}</div>}
    </main>
  );
}
