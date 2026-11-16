"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/chrome";
import { showToast } from "@/components/toast";
import { compressImage, fileToDataUrl } from "@/lib/compress-image";

const HI_STATE: Record<string, string> = {
  "Andhra Pradesh": "आंध्र प्रदेश", "Arunachal Pradesh": "अरुणाचल प्रदेश", Assam: "असम", Bihar: "बिहार", Chhattisgarh: "छत्तीसगढ़", Goa: "गोवा", Gujarat: "गुजरात", Haryana: "हरियाणा", "Himachal Pradesh": "हिमाचल प्रदेश", Jharkhand: "झारखंड", Karnataka: "कर्नाटक", Kerala: "केरल", "Madhya Pradesh": "मध्य प्रदेश", Maharashtra: "महाराष्ट्र", Manipur: "मणिपुर", Meghalaya: "मेघालय", Mizoram: "मिज़ोरम", Nagaland: "नागालैंड", Odisha: "ओडिशा", Punjab: "पंजाब", Rajasthan: "राजस्थान", Sikkim: "सिक्किम", "Tamil Nadu": "तमिलनाडु", Telangana: "तेलंगाना", Tripura: "त्रिपुरा", "Uttar Pradesh": "उत्तर प्रदेश", Uttarakhand: "उत्तराखंड", "West Bengal": "पश्चिम बंगाल", Delhi: "दिल्ली", "Jammu and Kashmir": "जम्मू और कश्मीर", Ladakh: "लद्दाख", Chandigarh: "चंडीगढ़", "Andaman and Nicobar Islands": "अंडमान और निकोबार",
};

const COPY = {
  en: {
    title: "Register a complaint",
    intro: "Tell us about your pump or solar problem. We will call you back within 24 hours.",
    name: "Name",
    mobile: "Mobile",
    otp: "Mobile code",
    send: "Send code",
    sent: "Code sent",
    state: "State",
    district: "District",
    pin: "Pincode",
    helpline: "Helpline",
    progress: "Uploading",
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
    state: "राज्य",
    district: "जिला",
    pin: "पिनकोड",
    helpline: "हेल्पलाइन",
    progress: "भेज रहे हैं",
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
  const [states, setStates] = useState<{ id: string; name: string }[]>([]);
  const [stateId, setStateId] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [districtHits, setDistrictHits] = useState<{ id: string; label: string }[]>([]);
  const [helpline, setHelpline] = useState("");
  const [progress, setProgress] = useState(0);
  const t = COPY[lang];
  useEffect(() => {
    fetch("/api/public/captcha").then(async (response) => {
      if (response.ok) setCaptcha(await response.json());
    }).catch(() => null);
    fetch("/api/public/places?kind=states").then(async (response) => {
      if (response.ok) setStates((await response.json()).rows ?? []);
    }).catch(() => null);
    fetch("/api/public/helpline").then(async (response) => {
      if (response.ok) setHelpline((await response.json()).helpline ?? "");
    }).catch(() => null);
  }, []);
  return (
    <main className="main public-shell" style={{ maxWidth: 720 }}>
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
        const phone = String(data.phone ?? "").replace(/\D/g, "");
        if (phone.length !== 10) {
          setError(lang === "hi" ? "10 अंकों का मोबाइल लिखें" : "Enter a 10-digit mobile");
          return;
        }
        const files = [...(form.querySelector("input[name=photos]") as HTMLInputElement).files ?? []].slice(0, 3);
        const photos: string[] = [];
        for (let index = 0; index < files.length; index += 1) {
          setProgress(Math.round(((index + 1) / Math.max(files.length, 1)) * 60));
          photos.push(await fileToDataUrl(await compressImage(files[index])));
        }
        const payload = JSON.stringify({ ...data, phone, photos, sameIssueAgain: again, product: data.product, stateName: states.find((item) => item.id === stateId)?.name });
        const response = await new Promise<Response>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/public/book");
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) setProgress(60 + Math.round((event.loaded / event.total) * 40));
          };
          xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
          xhr.onerror = () => reject(new Error("upload"));
          xhr.send(payload);
        });
        setProgress(0);
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
          const phone = String(new FormData(document.querySelector("form") as HTMLFormElement).get("phone") ?? "").replace(/\D/g, "");
          const response = await fetch("/api/public/otp-book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) { setError(body.error ?? "Could not send the code"); showToast(body.error ?? "Could not send the code"); return; }
          setOtpSent(body.devCode ? `${t.sent}: ${body.devCode}` : t.sent);
        }}>{t.send}</button>
        {otpSent && <p>{otpSent}</p>}
        <label className="stack">{t.otp} <span className="req">*</span><input name="otp" inputMode="numeric" maxLength={6} required /></label>
        <label className="stack">{t.state} <span className="req">*</span>
          <select name="stateId" required value={stateId} onChange={(event) => { setStateId(event.target.value); setDistrictQuery(""); }}>
            <option value="">{t.state}</option>
            {states.map((state) => <option key={state.id} value={state.id}>{lang === "hi" && HI_STATE[state.name] ? `${HI_STATE[state.name]} (${state.name})` : state.name}</option>)}
          </select>
        </label>
        <label className="stack">{t.pin} <span className="req">*</span><input name="pincode" inputMode="numeric" maxLength={6} pattern="[1-9][0-9]{5}" required onChange={async (event) => {
          const value = event.target.value.replace(/\D/g, "").slice(0, 6);
          event.target.value = value;
          if (!/^[1-9]\d{5}$/.test(value)) return;
          const response = await fetch(`/api/public/places?kind=pin&q=${value}`);
          const body = await response.json();
          const hit = body.rows?.[0];
          if (hit) { setStateId(hit.stateId); setDistrictQuery(hit.district); }
        }} /></label>
        <label className="stack">{t.district} <span className="req">*</span>
          <input name="districtName" required value={districtQuery} onChange={async (event) => {
            const value = event.target.value;
            setDistrictQuery(value);
            if (value.length < 2) return;
            const response = await fetch(`/api/public/places?kind=district&stateId=${stateId}&q=${encodeURIComponent(value)}`);
            if (response.ok) setDistrictHits((await response.json()).rows ?? []);
          }} />
          {districtHits.map((hit) => <button type="button" key={hit.id} className="chip" onClick={() => { setDistrictQuery(hit.label.split(",")[0].trim()); setDistrictHits([]); }}>{hit.label}</button>)}
        </label>
        <label className="stack">{t.product}
          <select name="product" required defaultValue="Solar pump">{PRODUCTS.map((item) => <option key={item}>{item}</option>)}</select>
        </label>
        <label className="stack">{t.problem}<textarea name="problem" required /></label>
        <label className="stack">{t.serial}<input name="serialNo" /></label>
        <label className="stack">{t.photo}<input name="photos" type="file" accept="image/*" multiple aria-label={t.photo} /></label>
        {progress > 0 && <p>{t.progress} {progress}%</p>}
        {helpline && <p>{t.helpline}: {helpline}</p>}
        <label className="stack">{captcha?.question ?? t.captcha}<input name="captchaAnswer" required /></label>
        <input type="hidden" name="captchaToken" value={captcha?.token ?? ""} />
        <label className="chip"><input type="checkbox" checked={again} onChange={(event) => setAgain(event.target.checked)} /> {t.again}</label>
        <button className="btn">{t.submit}</button>
      </form>
    </main>
  );
}
