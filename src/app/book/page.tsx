"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/chrome";
import { showToast } from "@/components/toast";
import { compressImage, fileToDataUrl } from "@/lib/compress-image";

const COPY = {
  en: {
    title: "Register a complaint",
    intro: "Tell us about your pump or solar problem. We will call you back within 24 hours.",
    name: "Name",
    mobile: "Mobile",
    otp: "Mobile code",
    send: "Send code",
    sent: "Code sent",
    district: "District",
    pin: "Pincode",
    product: "Product",
    problem: "What is the problem?",
    serial: "Serial number, if you can see it",
    photo: "Photo",
    captcha: "Captcha",
    submit: "Submit",
    again: "This is the same problem again",
    lang: "हिंदी",
  },
  hi: {
    title: "शिकायत दर्ज करें",
    intro: "पंप या सोलर की समस्या बताएं। हम 24 घंटे में कॉल करेंगे।",
    name: "नाम",
    mobile: "मोबाइल",
    otp: "मोबाइल कोड",
    send: "कोड भेजें",
    sent: "कोड भेज दिया",
    district: "जिला",
    pin: "पिनकोड",
    product: "उत्पाद",
    problem: "समस्या क्या है?",
    serial: "सीरियल नंबर, अगर दिखे",
    photo: "फोटो",
    captcha: "कैप्चा",
    submit: "भेजें",
    again: "यही समस्या फिर से है",
    lang: "English",
  },
};

const PRODUCTS = ["Solar pump", "Submersible pump", "Monoblock pump", "Controller", "Motor", "RMS", "Solar panel", "Rooftop system", "Inverter"];

export default function PublicBookPage() {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [captcha, setCaptcha] = useState<{ token: string; question: string } | null>(null);
  const [ticket, setTicket] = useState("");
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState("");
  const [again, setAgain] = useState(false);
  const t = COPY[lang];
  useEffect(() => {
    fetch("/api/public/captcha").then(async (response) => {
      if (response.ok) setCaptcha(await response.json());
    }).catch(() => null);
  }, []);
  return (
    <main className="main" style={{ maxWidth: 720 }}>
      <BrandLogo />
      <p className="kicker">Oswal Pumps Ltd · Karnal, Haryana</p>
      <div className="page-head">
        <h1 style={{ fontFamily: "var(--display)" }}>{t.title}</h1>
        <button type="button" className="btn line" onClick={() => setLang(lang === "en" ? "hi" : "en")}>{t.lang}</button>
      </div>
      <p>{t.intro}</p>
      {ticket && <div className="banner">Comp. No {ticket}</div>}
      {error && <div className="banner bad">{error}</div>}
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        const phone = String(data.phone ?? "").replace(/\D/g, "").slice(-10);
        if (phone.length !== 10) {
          setError(lang === "hi" ? "10 अंकों का मोबाइल लिखें" : "Enter a 10-digit mobile");
          return;
        }
        const files = [...(form.querySelector("input[name=photos]") as HTMLInputElement).files ?? []].slice(0, 3);
        const photos = await Promise.all(files.map(async (file) => fileToDataUrl(await compressImage(file))));
        const response = await fetch("/api/public/book", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, phone, photos, sameIssueAgain: again, product: data.product }),
        });
        const body = await response.json().catch(() => ({ error: "Could not save, please retry" }));
        if (response.status === 409) {
          setAgain(true);
          setError(body.error ?? (lang === "hi" ? "पहले से शिकायत खुली है। फिर से भेजें।" : "An open complaint already exists. Tick the box and submit again."));
          showToast(body.error ?? "Could not save, please retry");
          return;
        }
        if (!response.ok) {
          setError(body.error ?? "Could not save, please retry");
          showToast(body.error ?? "Could not save, please retry");
          return;
        }
        setTicket(body.ticketNo);
        setError("");
        form.reset();
      }}>
        <label className="stack">{t.name}<input name="customerName" required /></label>
        <label className="stack">{t.mobile} <span className="req">*</span><input name="phone" inputMode="numeric" maxLength={10} pattern="[6-9][0-9]{9}" required /></label>
        <button type="button" className="btn line" onClick={async () => {
          const phone = String(new FormData(document.querySelector("form") as HTMLFormElement).get("phone") ?? "").replace(/\D/g, "").slice(-10);
          const response = await fetch("/api/public/otp-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) { setError(body.error ?? "Could not send the code"); showToast(body.error ?? "Could not send the code"); return; }
          setOtpSent(body.devCode ? `${t.sent}: ${body.devCode}` : t.sent);
        }}>{t.send}</button>
        {otpSent && <p>{otpSent}</p>}
        <label className="stack">{t.otp} <span className="req">*</span><input name="otp" inputMode="numeric" maxLength={6} required /></label>
        <label className="stack">{t.district}<input name="districtName" required /></label>
        <label className="stack">{t.pin} <span className="req">*</span><input name="pincode" inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" required /></label>
        <label className="stack">{t.product}
          <select name="product" required defaultValue="Solar pump">{PRODUCTS.map((item) => <option key={item}>{item}</option>)}</select>
        </label>
        <label className="stack">{t.problem}<textarea name="problem" required /></label>
        <label className="stack">{t.serial}<input name="serialNo" /></label>
        <label className="stack">{t.photo}<input name="photos" type="file" accept="image/*" multiple /></label>
        <label className="stack">{captcha?.question ?? t.captcha}<input name="captchaAnswer" required /></label>
        <input type="hidden" name="captchaToken" value={captcha?.token ?? ""} />
        <label className="chip"><input type="checkbox" checked={again} onChange={(event) => setAgain(event.target.checked)} /> {t.again}</label>
        <button className="btn">{t.submit}</button>
      </form>
    </main>
  );
}
