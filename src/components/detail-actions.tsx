"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DetailActions({ complaint, engineers, problems, solutions, checks, can }: {
  complaint: { id: string; status: string };
  engineers: { id: string; name: string }[];
  problems: { id: string; name: string }[];
  solutions: { id: string; name: string }[];
  checks: { id: string; name: string }[];
  can: { assign: boolean; hold: boolean; close: boolean; happy: boolean; cancel: boolean; note: boolean; reopen: boolean };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<string>("");

  async function send(body: object) {
    const response = await fetch(`/api/desk/complaints/${complaint.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? "Could not update");
    else { setError(""); setPanel(""); router.refresh(); }
  }

  return (
    <div className="stack">
      <div className="chips">
        {can.assign && <button className="chip" onClick={() => setPanel("assign")}>Assign</button>}
        {can.hold && <button className="chip" onClick={() => setPanel("hold")}>Hold</button>}
        {can.close && <button className="chip" onClick={() => setPanel("close")}>Close</button>}
        {can.happy && <button className="chip" onClick={() => setPanel("happy")}>Happy calling</button>}
        {can.cancel && <button className="chip" onClick={() => setPanel("cancel")}>Cancel</button>}
        {can.reopen && <button className="chip" onClick={() => send({ action: "reopen" })}>Reopen</button>}
        {can.note && <button className="chip" onClick={() => setPanel("note")}>Note</button>}
      </div>
      {error && <div className="banner bad">{error}</div>}
      {panel === "assign" && (
        <form className="filters" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); send({ action: "assign", engineerId: data.get("engineerId") }); }}>
          <select name="engineerId" required><option value="">Technician</option>{engineers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          <button className="btn">Assign</button>
        </form>
      )}
      {panel === "hold" && (
        <form className="filters" onSubmit={(event) => { event.preventDefault(); send({ action: "hold", holdReason: new FormData(event.currentTarget).get("reason") }); }}>
          <input name="reason" placeholder="Why is it on hold?" required />
          <button className="btn">Hold</button>
        </form>
      )}
      {panel === "close" && (
        <form className="stack" onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const checklist = checks.filter((item) => data.get(`check-${item.id}`) === "on").map((item) => ({ itemId: item.id, checked: true }));
          send({ action: "close", problemId: data.get("problemId"), solutionId: data.get("solutionId"), problemText: data.get("problemText"), solutionText: data.get("solutionText"), checklist, serialNo: data.get("serialNo"), missingSerialReason: data.get("missingSerialReason"), nameplateCaptured: data.get("nameplate") === "on" });
        }}>
          <select name="problemId"><option value="">Actual problem</option>{problems.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          <input name="problemText" placeholder="Or type the problem" />
          <select name="solutionId"><option value="">Actual solution</option>{solutions.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          <input name="solutionText" placeholder="Or type the solution" />
          <input name="serialNo" placeholder="Serial from the nameplate, if you can read it" />
          <label className="chip"><input type="checkbox" name="nameplate" /> Nameplate photo taken</label>
          <input name="missingSerialReason" placeholder="Reason if the serial is still missing" />
          <div className="chips">{checks.map((item) => <label key={item.id} className="chip"><input type="checkbox" name={`check-${item.id}`} /> {item.name}</label>)}</div>
          <button className="btn">Close complaint</button>
        </form>
      )}
      {panel === "happy" && (
        <form className="filters" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); send({ action: "happy", rating: Number(data.get("rating")), remarks: data.get("remarks") }); }}>
          <select name="rating" defaultValue="5">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
          <input name="remarks" placeholder="What did the customer say?" />
          <button className="btn">Save feedback</button>
        </form>
      )}
      {panel === "cancel" && (
        <form className="filters" onSubmit={(event) => { event.preventDefault(); send({ action: "cancel", cancelReason: new FormData(event.currentTarget).get("reason") }); }}>
          <input name="reason" placeholder="Why cancel?" required />
          <button className="btn">Cancel complaint</button>
        </form>
      )}
      {panel === "note" && (
        <form className="stack" onSubmit={(event) => { event.preventDefault(); send({ action: "note", note: new FormData(event.currentTarget).get("note") }); }}>
          <textarea name="note" placeholder="Internal note" required />
          <button className="btn">Add note</button>
        </form>
      )}
      <form className="filters" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        data.set("complaintId", complaint.id);
        await fetch("/api/desk/attachments", { method: "POST", body: data });
        router.refresh();
      }}>
        <input type="file" name="file" required />
        <button className="btn line">Attach</button>
      </form>
    </div>
  );
}
