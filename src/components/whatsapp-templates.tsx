"use client";

import { useEffect, useState } from "react";
import { WHATSAPP_EVENTS, renderWhatsApp } from "@/lib/phase2";

const SAMPLE = { ticketNo: "OPL260101001", customerName: "Customer", engineer: "Technician", engineerPhone: "98xxxxxx", scheduleDate: "today", otp: "123456", link: "https://oswal.example/track" };

export function WhatsAppTemplates() {
  const [companies, setCompanies] = useState<{ id: string; shortName: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void fetch("/api/public/companies").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setCompanies(body.companies ?? []);
      setCompanyId(body.companies?.[0]?.id ?? "");
    });
  }, []);
  return (
    <div>
      <p className="muted">Log mode until a Meta Cloud or BSP key is set. Opt-out, the message log and the hourly limit stay on.</p>
      <div className="filters">
        <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
          {companies.map((company) => <option key={company.id} value={company.id}>{company.shortName}</option>)}
        </select>
        <button type="button" className={`chip ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>English</button>
        <button type="button" className={`chip ${lang === "hi" ? "on" : ""}`} onClick={() => setLang("hi")}>हिंदी</button>
      </div>
      {message && <div className="banner">{message}</div>}
      {WHATSAPP_EVENTS.map((event) => {
        const rendered = renderWhatsApp(event, lang, SAMPLE);
        return (
          <form key={event} className="panel stack" style={{ marginBottom: 12 }} onSubmit={async (submit) => {
            submit.preventDefault();
            const body = String(new FormData(submit.currentTarget).get("body") ?? "");
            const response = await fetch("/api/desk/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ kind: "wa-template", companyId, event: `WA_${event}_${lang.toUpperCase()}`, body }),
            });
            setMessage(response.ok ? `${event} saved for ${lang}.` : "Could not save");
          }}>
            <h2>{event}</h2>
            <p className="muted">Template name {rendered.template}</p>
            <textarea name="body" defaultValue={rendered.body} key={`${event}-${lang}`} />
            <button className="btn line">Save</button>
          </form>
        );
      })}
    </div>
  );
}
