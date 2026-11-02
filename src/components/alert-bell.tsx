"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

type AlertRow = { id: string; kind: string; message: string; complaintId: string | null; createdAt: string };

export function AlertBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rows, setRows] = useState<AlertRow[]>([]);

  async function load() {
    const response = await fetch("/api/desk/alerts");
    if (!response.ok) return;
    const body = await response.json();
    setUnread(body.unread ?? 0);
    setRows(body.rows ?? []);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="user-menu">
      <button type="button" className="icon-btn" aria-label="Alerts" onClick={() => { setOpen((value) => !value); void load(); }}>
        <Bell size={16} />
        {unread > 0 && <span className="alert-count">{unread}</span>}
      </button>
      {open && (
        <div className="user-pop alert-pop">
          <div style={{ padding: 8 }}>{unread} unread</div>
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
