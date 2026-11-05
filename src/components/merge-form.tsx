"use client";

import { useState } from "react";

export function MergeForm({ keepId }: { keepId: string }) {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <form className="stack" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setMessage("");
      const response = await fetch("/api/desk/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, phone }),
      });
      const body = await response.json();
      setPending(false);
      setMessage(response.ok ? `Merged ${body.complaintsMoved} complaint${body.complaintsMoved === 1 ? "" : "s"} into this record.` : body.error ?? "Could not merge");
      if (response.ok) setPhone("");
    }}>
      <label className="stack">Mobile of the duplicate record
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="10-digit mobile" required />
      </label>
      <button className="btn line" disabled={pending}>{pending ? "Merging…" : "Merge into this customer"}</button>
      {message && <p className="muted">{message}</p>}
    </form>
  );
}
