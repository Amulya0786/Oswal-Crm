"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMPLAINT_TYPES, labelOf } from "@/lib/constants";

export function SlaForm({ policies }: { policies: { complaintType: string; responseHours: number; closeHours: number; escalationCooldownHours: number }[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(policies);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/sla", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ policies: rows }) });
    const data = await response.json();
    setMessage(response.ok ? "SLA policies saved. New complaints use them immediately." : data.error ?? "Could not save.");
    if (response.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="card overflow-x-auto p-4">
      <table className="data">
        <thead><tr><th>Type</th><th>Response hours</th><th>Closing hours</th><th>Escalation cooldown</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.complaintType}>
              <td>{labelOf(COMPLAINT_TYPES, row.complaintType)}</td>
              {(["responseHours", "closeHours", "escalationCooldownHours"] as const).map((key) => (
                <td key={key}>
                  <input className="field w-28" type="number" min={1} value={row[key]} onChange={(event) => {
                    const copy = [...rows];
                    copy[index] = { ...row, [key]: Number(event.target.value) };
                    setRows(copy);
                  }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn btn-accent mt-3">Save SLAs</button>
      {message ? <p className="mt-2 text-sm">{message}</p> : null}
    </form>
  );
}

export function TemplateEditor({ templates }: { templates: { id: string; event: string; channel: string; subject: string | null; body: string; active: boolean }[] }) {
  const [rows, setRows] = useState(templates);
  const [message, setMessage] = useState("");

  async function save(template: (typeof rows)[number]) {
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(template),
    });
    const data = await response.json();
    setMessage(response.ok ? `Saved ${template.event} / ${template.channel}.` : data.error ?? "Could not save.");
  }

  return (
    <div className="space-y-3">
      {rows.map((template, index) => (
        <form key={template.id} className="card space-y-2 p-4" onSubmit={(event) => { event.preventDefault(); void save(template); }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-navy">{template.event} · {template.channel}</h2>
            <label className="text-sm"><input type="checkbox" checked={template.active} onChange={(event) => update(index, { active: event.target.checked })} /> Active</label>
          </div>
          {template.channel === "email" ? <input className="field" value={template.subject ?? ""} onChange={(event) => update(index, { subject: event.target.value })} placeholder="Subject" /> : null}
          <textarea className="field min-h-24" value={template.body} onChange={(event) => update(index, { body: event.target.value })} />
          <p className="text-xs text-muted">Placeholders: {"{{ticketNumber}} {{customerName}} {{technicianName}} {{centerName}} {{feedbackLink}} {{type}}"}</p>
          <button className="btn btn-navy">Save template</button>
        </form>
      ))}
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );

  function update(index: number, patch: Partial<(typeof rows)[number]>) {
    const copy = [...rows];
    copy[index] = { ...copy[index], ...patch };
    setRows(copy);
  }
}
