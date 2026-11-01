"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/chrome";
import { companyCodeForCategory } from "@/lib/company-tag";

const PUBLIC_CATEGORIES = ["Solar Pump", "Submersible Pump", "Monoblock Pump", "Controller", "Motor", "RMS", "Solar Panel", "Rooftop System", "Inverter"];

export default function PublicBookPage() {
  const [companies, setCompanies] = useState<{ id: string; shortName: string; legalName: string; accent: string; code: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [captcha, setCaptcha] = useState<{ token: string; question: string } | null>(null);
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("company") === "solar" ? "SOLAR" : "PUMPS";
    fetch("/api/public/companies").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setCompanies(body.companies);
      setCompanyId(body.companies.find((item: { code: string }) => item.code === code)?.id ?? body.companies[0]?.id);
    }).catch(() => null);
    fetch("/api/public/captcha").then(async (response) => {
      if (response.ok) setCaptcha(await response.json());
    }).catch(() => null);
  }, []);
  const company = companies.find((item) => item.id === companyId);
  return (
    <main className="main" style={{ maxWidth: 720 }}>
      <BrandLogo />
      <p className="kicker" style={{ color: company?.accent }}>{company?.legalName ?? "Oswal"}</p>
      <h1 style={{ fontFamily: "var(--display)" }}>Register a complaint</h1>
      <p className="muted">For the website. The same Comp. No series, company rule and duplicate checks as the desk.</p>
      <div className="chips">{companies.map((item) => <button type="button" key={item.id} className={`chip ${item.id === companyId ? "on" : ""}`} onClick={() => setCompanyId(item.id)}>{item.shortName}</button>)}</div>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        const files = [...(form.querySelector("input[name=photos]") as HTMLInputElement).files ?? []].slice(0, 3);
        const photos = await Promise.all(files.filter((file) => file.size <= 1_200_000).map((file) => new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(file);
        })));
        const response = await fetch("/api/public/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, photos, companyId, product: data.product, problem: data.problem, natureText: data.problem, callType: "BREAKDOWN", captchaToken: captcha?.token }),
        });
        const body = await response.json();
        if (!response.ok) setError(body.error ?? "Could not book");
        else setTicket(body.ticketNo);
      }}>
        <input name="customerName" placeholder="Name" required />
        <div className="filters">
          <input name="phone" placeholder="Mobile" required />
          <button type="button" className="btn line" onClick={async () => {
            const phone = (document.querySelector("input[name=phone]") as HTMLInputElement | null)?.value ?? "";
            const response = await fetch("/api/public/otp-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
            const body = await response.json();
            setOtpSent(response.ok ? (body.devCode ? `Code ${body.devCode} (log only)` : "Code sent") : body.error);
          }}>Send OTP</button>
        </div>
        {otpSent && <p className="muted">{otpSent}</p>}
        <input name="otp" placeholder="Mobile OTP" required />
        <input name="districtName" placeholder="District" required />
        <input name="pincode" placeholder="Pincode" required />
        <select name="product" defaultValue="Solar Pump" onChange={(event) => {
          const code = companyCodeForCategory(event.target.value);
          const next = companies.find((item) => item.code === code);
          if (next) setCompanyId(next.id);
        }}>{PUBLIC_CATEGORIES.map((name) => <option key={name}>{name}</option>)}</select>
        <textarea name="problem" placeholder="What is the problem?" required />
        <input name="serialNo" placeholder="Serial, if you can see it" />
        <label className="stack">Photos<input name="photos" type="file" accept="image/*" multiple /></label>
        <label className="stack">{captcha?.question ?? "Captcha"}<input name="captchaAnswer" required placeholder="Answer" /></label>
        <button className="btn">Submit</button>
      </form>
      <p className="muted">Embed on oswalpumps.com with an iframe pointed at /book. The API is POST /api/public/book after the OTP and captcha.</p>
      {ticket && <div className="banner">Your Comp. No is <b className="mono">{ticket}</b>.</div>}
      {error && <div className="banner bad">{error}</div>}
    </main>
  );
}
