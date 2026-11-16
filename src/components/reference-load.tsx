"use client";

import { useState } from "react";

export function ReferenceLoad() {
  const [message, setMessage] = useState("");
  return (
    <section className="panel stack">
      <form onSubmit={async (event) => {
        event.preventDefault();
        const response = await fetch("/api/desk/reference", { method: "POST" });
        const body = await response.json();
        setMessage(response.ok ? `Added ${body.created}` : (body.error ?? "Could not load"));
      }}>
        <button className="btn">Load reference data</button>
      </form>
      <form className="stack" onSubmit={async (event) => {
        event.preventDefault();
        const csv = String(new FormData(event.currentTarget).get("csv") ?? "");
        const response = await fetch("/api/desk/pincodes-csv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv }) });
        const body = await response.json();
        setMessage(response.ok ? `Pincodes added ${body.created}` : (body.error ?? "Could not import"));
      }}>
        <textarea name="csv" rows={4} placeholder="Pincode, district, state" />
        <button className="btn line">Import pincodes</button>
      </form>
      {message && <p>{message}</p>}
    </section>
  );
}