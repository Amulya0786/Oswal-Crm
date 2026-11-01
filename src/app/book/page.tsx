"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/chrome";
import { companyCodeForCategory } from "@/lib/company-tag";

const PUBLIC_CATEGORIES = ["Solar Pump", "Submersible Pump", "Monoblock Pump", "Controller", "Motor", "RMS", "Solar Panel", "Rooftop System", "Inverter"];

export default function PublicBookPage() {
  const [companies, setCompanies] = useState<{ id: string; shortName: string; legalName: string; accent: string; code: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    fetch("/api/health").catch(() => null);
    const code = params.get("company") === "solar" ? "SOLAR" : "PUMPS";
    fetch("/api/public/companies").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setCompanies(body.companies);
      setCompanyId(body.companies.find((item: { code: string }) => item.code === code)?.id ?? body.companies[0]?.id);
    }).catch(() => null);
  }, []);
  const company = companies.find((item) => item.id === companyId);
  return (
    <main className="main" style={{ maxWidth: 720 }}>
      <BrandLogo />
      <p className="kicker" style={{ color: company?.accent }}>{company?.legalName ?? "Oswal"}</p>
      <h1 style={{ fontFamily: "var(--display)" }}>Book a complaint</h1>
      <div className="chips">{companies.map((item) => <button type="button" key={item.id} className={`chip ${item.id === companyId ? "on" : ""}`} onClick={() => setCompanyId(item.id)}>{item.shortName}</button>)}</div>
      <p className="muted">The company follows the product. You can change it.</p>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget).entries());
        const source = new URLSearchParams(window.location.search).get("src") === "qr" ? "QR" : "WEB";
        const response = await fetch("/api/public/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, companyId, source, natureText: data.natureText, callType: data.callType }) });
        const body = await response.json();
        if (!response.ok) setError(body.error);
        else setTicket(body.ticketNo);
      }}>
        <input name="customerName" placeholder="Your name" required />
        <input name="phone" placeholder="Mobile" required />
        <input name="serialNo" placeholder="Serial on the pump, if you can see it" />
        <label className="chip"><input type="checkbox" name="serialUnavailable" value="true" /> Serial not available</label>
        <select name="serialUnavailableReason" defaultValue="STICKER_MISSING">
          <option value="STICKER_MISSING">Sticker missing or damaged</option>
          <option value="CUSTOMER_ABSENT">I am not at the pump</option>
          <option value="SCHEME">Scheme beneficiary, serial not with me</option>
          <option value="OTHER">Other</option>
        </select>
        <input name="address" placeholder="Address" />
        <input name="pincode" placeholder="Pincode" required />
        <select name="productCategory" defaultValue="Solar Pump" onChange={(event) => {
          const code = companyCodeForCategory(event.target.value);
          const next = companies.find((item) => item.code === code);
          if (next) setCompanyId(next.id);
        }}>
          {PUBLIC_CATEGORIES.map((name) => <option key={name}>{name}</option>)}
        </select>
        <select name="callType" defaultValue="BREAKDOWN"><option value="BREAKDOWN">Breakdown</option><option value="INSTALLATION">Installation</option><option value="SCHEME">Scheme / KUSUM</option><option value="INSURANCE">Insurance</option></select>
        <input name="natureText" placeholder="What is wrong?" required />
        <button className="btn">Submit</button>
      </form>
      {ticket && <div className="banner">Booked. Your Comp. No is <b className="mono">{ticket}</b>. Track it with your mobile.</div>}
      {error && <div className="banner bad">{error}</div>}
    </main>
  );
}
