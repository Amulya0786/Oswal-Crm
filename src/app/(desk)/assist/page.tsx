"use client";

import { useState } from "react";

const TABS = ["Booking", "Fix steps", "Ask"] as const;

export default function AssistPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Booking");
  const [text, setText] = useState("pending solar controller complaints in Buldhana older than 7 days");
  const [result, setResult] = useState("");
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const kind = tab === "Booking" ? "book" : tab === "Fix steps" ? "fix" : "ask";
    const response = await fetch("/api/desk/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, text }),
    });
    const body = await response.json();
    setResult(response.ok ? JSON.stringify(body, null, 2) : body.error ?? "Could not ask");
    setPending(false);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Suggestions</p>
          <h1>Suggestions</h1>
          <p>Booking hints, likely fixes, and plain-language search. Without an AI key the answers are a local mock. The daily management note is on Daily summary.</p>
        </div>
      </div>
      <div className="chips">
        {TABS.map((item) => <button key={item} className={`chip ${tab === item ? "on" : ""}`} onClick={() => { setTab(item); setResult(""); }}>{item}</button>)}
      </div>
      <section className="panel stack">
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={tab === "Booking" ? "Customer description, Hindi or English" : tab === "Fix steps" ? "Actual problem" : "Ask in plain language"} />
        <button className="btn" disabled={pending} onClick={() => void run()}>{pending ? "Working…" : "Ask"}</button>
        {result && <pre className="muted">{result}</pre>}
        {!result && <p className="muted">Nothing asked yet. Booking can suggest a category and a repeat. Fix steps use closed complaints. Ask can look for a district and an age.</p>}
      </section>
    </div>
  );
}
