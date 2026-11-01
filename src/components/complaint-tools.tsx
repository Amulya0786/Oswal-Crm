"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ListRow } from "@/server/query";
import { labelOf, CALL_TYPES, STATUSES, statusClass } from "@/lib/labels";
import { formatDay } from "@/lib/time";

type Engineer = { id: string; name: string };
type Named = { id: string; name: string };

export function SaveView() {
  return (
    <form className="filters" onSubmit={async (event) => {
      event.preventDefault();
      const name = new FormData(event.currentTarget).get("name");
      const filters = Object.fromEntries(new URLSearchParams(window.location.search).entries());
      await fetch("/api/desk/views", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, filters }) });
      window.location.reload();
    }}>
      <input name="name" placeholder="Save this view" />
      <button className="btn line" type="submit">Save</button>
    </form>
  );
}

export function ComplaintTable({
  rows,
  engineers,
  problems,
  solutions,
  can,
}: {
  rows: ListRow[];
  engineers: Engineer[];
  problems: Named[];
  solutions: Named[];
  can: { assign: boolean; hold: boolean; close: boolean; happy: boolean; cancel: boolean };
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [dense, setDense] = useState(false);
  const all = useMemo(() => rows.map((row) => row.id), [rows]);

  async function act(id: string, body: object) {
    const response = await fetch(`/api/desk/complaints/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) setMessage(payload.error ?? "Could not update");
    else router.refresh();
  }

  async function bulk(body: object) {
    const response = await fetch("/api/desk/complaints/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: picked, ...body }) });
    const payload = await response.json();
    setMessage(response.ok ? `Updated ${payload.updated}` : payload.error);
    setPicked([]);
    router.refresh();
  }

  async function exportSelected() {
    const params = new URLSearchParams(window.location.search);
    const filters = Object.fromEntries(params.entries());
    const response = await fetch("/api/desk/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filters }) });
    if (response.ok) window.location.href = "/exports";
  }

  return (
    <div>
      {message && <div className="banner">{message}</div>}
      {picked.length > 0 && (
        <div className="filters">
          <span>{picked.length} selected</span>
          {can.assign && (
            <select defaultValue="" onChange={(event) => event.target.value && bulk({ action: "assign", engineerId: event.target.value })}>
              <option value="">Reassign…</option>
              {engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name}</option>)}
            </select>
          )}
          {can.hold && <button className="btn line" onClick={() => bulk({ action: "hold", reason: "Bulk hold" })}>Hold</button>}
          <button className="btn line" onClick={() => exportSelected()}>Export page</button>
        </div>
      )}
      <div className="table-toolbar">
        <button type="button" className="btn line" onClick={() => setDense((value) => !value)}>{dense ? "Comfortable rows" : "Compact rows"}</button>
      </div>
      <div className={`table-wrap ${dense ? "table-dense" : ""}`}>
        <table>
          <thead>
            <tr>
              <th></th><th>Comp. No</th><th>Book date</th><th>Customer</th><th>Mobile</th><th>District</th><th>Call type</th><th>Product</th><th>Assigned</th><th>Status</th><th>Age</th><th></th>
            </tr>
          </thead>
          <tbody>
            {!rows.length && (
              <tr><td colSpan={12}><div className="empty-inline"><b>The register is empty</b><span>Book the first call, or clear the filters. Nothing is hidden.</span></div></td></tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td data-label=""><input type="checkbox" checked={picked.includes(row.id)} onChange={(event) => setPicked(event.target.checked ? [...picked, row.id] : picked.filter((id) => id !== row.id))} /></td>
                <td data-label="Comp. No"><a className="mono" href={`/complaints/${row.ticketNo}`}>{row.ticketNo}</a>{row.serialPending && " · Serial pending"}{row.slaBreached && " · SLA"}{row.slaRisk && " · Risk"}{row.repeatFlag && " · Repeat"}</td>
                <td data-label="Book date">{formatDay(row.bookDate)}</td>
                <td data-label="Customer">{row.customerName}<div className="muted">{row.companyName}</div></td>
                <td data-label="Mobile">{row.phone}</td>
                <td data-label="District">{row.districtName}<div className="muted">{row.stateName}</div></td>
                <td data-label="Call type">{labelOf(CALL_TYPES, row.callType)}</td>
                <td data-label="Product">{row.productDetails}</td>
                <td data-label="Assigned">{row.assignedName ?? "—"}</td>
                <td data-label="Status"><span className={statusClass(row.status)}>{labelOf(STATUSES, row.status)}</span></td>
                <td data-label="Age" className="num">{row.ageDays}d</td>
                <td data-label="Action">
                  <details>
                    <summary>Update</summary>
                    <div className="stack">
                      {can.assign && <select defaultValue="" onChange={(event) => event.target.value && act(row.id, { action: "assign", engineerId: event.target.value })}><option value="">Assign…</option>{engineers.map((engineer) => <option key={engineer.id} value={engineer.id}>{engineer.name}</option>)}</select>}
                      {can.hold && <button className="btn line" onClick={() => act(row.id, { action: "hold", holdReason: "Customer not available" })}>Hold</button>}
                      {can.close && <button className="btn line" onClick={() => act(row.id, { action: "close", problemId: problems[0]?.id, solutionId: solutions[0]?.id })}>Close with first problem</button>}
                      {can.happy && row.status === "CLOSED" && <button className="btn line" onClick={() => act(row.id, { action: "happy", rating: 5 })}>Happy call 5</button>}
                      {can.cancel && <button className="btn line" onClick={() => act(row.id, { action: "cancel", cancelReason: "Cancelled from the list" })}>Cancel</button>}
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && <button className="btn line" onClick={() => setPicked(picked.length === all.length ? [] : all)}>Select this page</button>}
    </div>
  );

}

export function ComplaintFeed({
  initial,
  nextCursor,
  search,
  engineers,
  problems,
  solutions,
  can,
}: {
  initial: ListRow[];
  nextCursor: string | null;
  search: string;
  engineers: Engineer[];
  problems: Named[];
  solutions: Named[];
  can: { assign: boolean; hold: boolean; close: boolean; happy: boolean; cancel: boolean };
}) {
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const lock = useRef(false);
  useEffect(() => {
    const node = document.getElementById("complaint-more");
    if (!node) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry?.isIntersecting || !cursor || lock.current) return;
      lock.current = true;
      const response = await fetch(`/api/desk/complaints?${search}&cursor=${encodeURIComponent(cursor)}`);
      if (response.ok) {
        const body = await response.json();
        setRows((current) => [...current, ...(body.rows ?? [])]);
        setCursor(body.nextCursor ?? null);
      }
      lock.current = false;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, search]);
  return (
    <>
      <ComplaintTable rows={rows} engineers={engineers} problems={problems} solutions={solutions} can={can} />
      <div id="complaint-more" />
    </>
  );
}
