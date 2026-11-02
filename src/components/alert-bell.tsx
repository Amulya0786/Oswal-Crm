"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

type AlertRow = { id: string; kind: string; message: string; complaintId: string | null; stateId: string | null; createdAt: string };
type KindCount = { kind: string; count: number };
type StateOption = { id: string; name: string };

export function AlertBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [matched, setMatched] = useState(0);
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [kinds, setKinds] = useState<KindCount[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [kind, setKind] = useState("");
  const [stateId, setStateId] = useState("");

  async function load(nextKind = kind, nextState = stateId) {
    const params = new URLSearchParams();
    if (nextKind) params.set("kind", nextKind);
    if (nextState) params.set("stateId", nextState);
    const response = await fetch(`/api/desk/alerts?${params.toString()}`);
    if (!response.ok) return;
    const body = await response.json();
    setUnread(body.unread ?? 0);
    setMatched(body.matched ?? 0);
    setRows(body.rows ?? []);
    setKinds(body.kinds ?? []);
    setStates(body.states ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function markAll() {
    await fetch("/api/desk/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, kind: kind || undefined, stateId: stateId || undefined }),
    });
    await load();
  }

  return (
    <div className="user-menu">
      <button type="button" className="icon-btn" aria-label="Alerts" onClick={() => { setOpen((value) => !value); void load(); }}>
        <Bell size={16} />
        {unread > 0 && <span className="alert-count">{unread}</span>}
      </button>
      {open && (
        <div className="user-pop alert-pop">
          <div className="alert-tools">
            <span>{matched} unread{kind || stateId ? " in this filter" : ""}</span>
            <select aria-label="Alert type" value={kind} onChange={(event) => { setKind(event.target.value); void load(event.target.value, stateId); }}>
              <option value="">All types</option>
              {kinds.map((item) => <option key={item.kind} value={item.kind}>{item.kind} ({item.count})</option>)}
            </select>
            <select aria-label="Alert state" value={stateId} onChange={(event) => { setStateId(event.target.value); void load(kind, event.target.value); }}>
              <option value="">All states</option>
              {states.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="button" className="btn line" disabled={matched === 0} onClick={() => void markAll()}>Mark all done</button>
          </div>
          {!rows.length && <p className="muted">No open alerts.</p>}
          {rows.map((row) => (
            <div key={row.id} className="alert-row">
              <a href={row.complaintId ? `/complaints/${row.complaintId}` : "/assign"}>{row.message}</a>
              <button type="button" className="btn line" onClick={async () => {
                await fetch("/api/desk/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
                await load();
              }}>Done</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
