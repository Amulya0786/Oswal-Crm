"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProofRules } from "@/components/proof-rules";
import { WhatsAppTemplates } from "@/components/whatsapp-templates";

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"desk" | "whatsapp" | "proof">("desk");
  async function load() {
    const response = await fetch("/api/desk/settings");
    if (response.ok) setData(await response.json());
  }
  useEffect(() => {
    void load();
    const asked = new URLSearchParams(window.location.search).get("tab");
    if (asked === "whatsapp" || asked === "proof" || asked === "desk") setTab(asked);
  }, []);
  async function post(body: object) {
    const response = await fetch("/api/desk/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    setMessage(response.ok ? JSON.stringify(payload).slice(0, 240) : payload.error);
    await load();
  }
  if (!data) return <p>Loading settings…</p>;
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Admin</p><h1>Settings</h1><p>SLAs, message wording, and what a technician must capture at close. <Link href="/developers">API notes</Link></p></div></div>
      <div className="chips">
        {([["desk", "Desk"], ["whatsapp", "WhatsApp"], ["proof", "Proof"]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`chip ${tab === id ? "on" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {message && <div className="banner">{message}</div>}
      {tab === "whatsapp" && <WhatsAppTemplates />}
      {tab === "proof" && <ProofRules />}
      {tab === "desk" && <>
      <section className="panel">
        <h2>SLA hours</h2>
        {data.slas.map((row: any) => (
          <form key={row.id} className="filters" onSubmit={(event) => { event.preventDefault(); post({ kind: "sla", companyId: row.companyId, callType: row.callType, hours: new FormData(event.currentTarget).get("hours") }); }}>
            <span>{row.company.shortName} · {row.callType}</span>
            <input name="hours" defaultValue={row.hours} />
            <button className="btn line">Save</button>
          </form>
        ))}
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Rules</h2>
        {data.rules.map((rule: any) => <p key={rule.id}>{rule.name} <button className="btn line" onClick={() => post({ kind: "rule-delete", id: rule.id })}>Remove</button><br /><span className="muted">{rule.definition}</span></p>)}
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const dataForm = new FormData(event.currentTarget);
          post({
            kind: "rule",
            name: dataForm.get("name"),
            definition: {
              all: [
                ...(dataForm.get("callType") ? [{ field: "callType", op: "eq", value: dataForm.get("callType") }] : []),
                ...(dataForm.get("hours") ? [{ field: "ageHours", op: "gt", value: Number(dataForm.get("hours")) }] : []),
              ],
              actions: [{ type: "escalate" }, { type: "setPriority", value: "URGENT" }, { type: "notify" }],
            },
          });
        }}>
          <div className="filters">
            <input name="name" placeholder="Rule name" required />
            <select name="callType"><option value="BREAKDOWN">Breakdown</option><option value="INSTALLATION">Installation</option><option value="SCHEME">Scheme</option></select>
            <input name="hours" type="number" placeholder="Older than hours" defaultValue={48} />
            <button className="btn">Add rule</button>
          </div>
        </form>
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Notification templates</h2>
        {data.templates.slice(0, 8).map((row: any) => <p key={row.id} className="muted">{row.event} · {row.channel}<br />{row.body}</p>)}
      </section>
      <div className="filters" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => post({ kind: "escalate" })}>Run escalation now</button>
        <button className="btn line" onClick={() => post({ kind: "summary" })}>Generate daily summary</button>
      </div>
      {data.summary && <section className="panel" style={{ marginTop: 12 }}><h2>Last summary</h2><pre>{(data.summary.lines ?? []).join("\n")}</pre></section>}
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>Recent escalations</h2>
        {data.escalations.map((row: any) => <p key={row.id}>{row.message}</p>)}
      </section>
      <form className="filters" style={{ marginTop: 12 }} onSubmit={(event) => { event.preventDefault(); const dataForm = new FormData(event.currentTarget); post({ kind: "webhook", url: dataForm.get("url"), secret: dataForm.get("secret") }); }}>
        <input name="url" placeholder="Webhook URL" required />
        <input name="secret" placeholder="Secret" />
        <button className="btn line">Add webhook</button>
      </form>
      </>}
    </div>
  );
}
