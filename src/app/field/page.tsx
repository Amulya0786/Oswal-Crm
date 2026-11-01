"use client";

import { useEffect, useState } from "react";
import { BrandLogo, EmptyState } from "@/components/chrome";
import { FIELD_COPY, type FieldLang } from "@/lib/i18n";

type Visit = { id: string; ticketNo: string; customerName: string; phone: string; address: string | null; districtName: string | null; pincode: string | null; status: string; productDetails: string | null; serialPending: boolean; lat: number | null; lng: number | null };

export default function FieldPage() {
  const [lang, setLang] = useState<FieldLang>("en");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [earnings, setEarnings] = useState<{ visits: number; rate: number; amount: number } | null>(null);
  const [message, setMessage] = useState("");
  const copy = FIELD_COPY[lang];

  useEffect(() => {
    const saved = window.localStorage.getItem("oswal-lang");
    if (saved === "hi" || saved === "en") setLang(saved);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => null);
    void refresh();
  }, []);

  async function refresh() {
    const [today, pay] = await Promise.all([fetch("/api/field/today"), fetch("/api/field/earnings")]);
    if (today.ok) setVisits((await today.json()).visits ?? []);
    if (pay.ok) setEarnings(await pay.json());
  }

  async function send(path: string, body: object) {
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not save");
      setMessage(payload.devCode ? `OTP ${payload.devCode} logged. No WhatsApp key is set.` : "Saved");
      await refresh();
    } catch (error) {
      const queue = JSON.parse(window.localStorage.getItem("oswal-queue") || "[]");
      queue.push({ path, body, at: Date.now() });
      window.localStorage.setItem("oswal-queue", JSON.stringify(queue));
      setMessage(error instanceof Error ? `${error.message} Saved on this phone until the network returns.` : "Saved offline");
    }
  }

  function locate(kind: "START" | "ARRIVE", id: string) {
    if (!navigator.geolocation) return void send("/api/field/checkin", { complaintId: id, kind });
    navigator.geolocation.getCurrentPosition(
      (pos) => void send("/api/field/checkin", { complaintId: id, kind, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => void send("/api/field/checkin", { complaintId: id, kind }),
    );
  }

  return (
    <main className="field-app">
      <header className="field-bar">
        <BrandLogo collapsed />
        <strong>Oswal</strong>
        <button className="btn line" onClick={() => {
          const next = lang === "en" ? "hi" : "en";
          setLang(next);
          window.localStorage.setItem("oswal-lang", next);
        }}>{copy.lang}</button>
      </header>
      <h1>{copy.title}</h1>
      {message && <div className="banner">{message}</div>}
      {!visits.length && <EmptyState title={copy.empty} body={lang === "hi" ? "विज़िट में मैप, GPS, सीरियल या नेमप्लेट, फोटो, स्पेयर, हस्ताक्षर और ग्राहक OTP शामिल हैं।" : "A visit includes the map link, GPS check-in, serial scan or nameplate photo, before and after photos, the problem and solution, spares, a signature, and the customer OTP."} />}
      {visits.map((visit) => (
        <article key={visit.id} className="panel stack">
          <b className="mono">{visit.ticketNo}</b>
          <span>{visit.customerName} · {visit.phone}</span>
          <span className="muted">{visit.districtName} · {visit.pincode}</span>
          <span>{visit.productDetails}{visit.serialPending ? " · Serial pending" : ""}</span>
          <a className="btn line" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([visit.address, visit.districtName, visit.pincode].filter(Boolean).join(", "))}`}>Map</a>
          <div className="filters">
            <button className="btn line" onClick={() => locate("START", visit.id)}>{copy.start}</button>
            <button className="btn" onClick={() => locate("ARRIVE", visit.id)}>{copy.arrive}</button>
          </div>
          <p className="muted">{copy.scan} · {copy.close} · {copy.hold}</p>
        </article>
      ))}
      <section className="panel">
        <h2>{copy.attendance}</h2>
        <div className="filters">
          <button className="btn" onClick={() => void send("/api/field/punch", { kind: "IN" })}>{copy.in}</button>
          <button className="btn line" onClick={() => void send("/api/field/punch", { kind: "OUT" })}>{copy.out}</button>
        </div>
      </section>
      <section className="panel stack">
        <h2>{lang === "hi" ? "बंद करने के प्रमाण" : "Closing proof"}</h2>
        <p className="muted">{lang === "hi" ? "फोटो, हस्ताक्षर या OTP, और GPS ज़रूरी हैं। दूर का पिन चिह्नित होता है।" : "A close needs a site photo, a signature or the customer OTP, and GPS. A pin far from the customer is flagged."}</p>
        <canvas aria-label="Signature" width={320} height={90} style={{ width: "100%", background: "#fff", borderRadius: 12, border: "1px solid #d5e4db" }} />
      </section>
      <section className="panel">
        <h2>{copy.earnings}</h2>
        <p>{copy.visits}: <b>{earnings?.visits ?? 0}</b></p>
        <p className="muted">{earnings?.rate ? `₹${earnings.amount}` : "Visit rate is not configured."}</p>
      </section>
    </main>
  );
}
