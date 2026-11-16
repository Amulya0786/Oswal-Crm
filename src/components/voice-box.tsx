"use client";

import { useState } from "react";

export function VoiceBox({ complaintId }: { complaintId: string }) {
  const [note, setNote] = useState("");
  const [summary, setSummary] = useState("");

  async function save(file: File) {
    const audio = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    const lang = window.localStorage.getItem("oswal-lang") === "hi" ? "hi" : "en";
    const response = await fetch("/api/desk/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complaintId, audio, lang }),
    });
    const body = await response.json();
    setNote(response.ok ? body.transcript : body.error ?? "Could not save");
  }

  return (
    <details className="panel" style={{ marginTop: 12 }}>
      <summary>Voice note and summary</summary>
      <div className="stack" style={{ marginTop: 10 }}>
        <label className="stack">Record or choose a voice note
          <input type="file" accept="audio/*" capture onChange={(event) => { const file = event.target.files?.[0]; if (file) void save(file); }} />
        </label>
        {note && <p>{note}</p>}
        <button className="btn line" onClick={async () => {
          const response = await fetch("/api/desk/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "summary", complaintId }) });
          const body = await response.json();
          setSummary(response.ok ? body.text : body.error ?? "Could not summarise");
        }}>Summarise the timeline</button>
        {summary && <p className="muted">{summary}</p>}
      </div>
    </details>
  );
}
