"use client";

import { useState } from "react";

export function AssetCoverForm({ assetId, warrantyUntil, amcUntil }: { assetId: string; warrantyUntil: string; amcUntil: string }) {
  const [message, setMessage] = useState("");
  return (
    <form className="filters" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const response = await fetch(`/api/desk/assets/${assetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warrantyUntil: form.get("warrantyUntil"), amcUntil: form.get("amcUntil") }),
      });
      const body = await response.json();
      setMessage(response.ok ? "Warranty and AMC saved." : body.error ?? "Could not save");
    }}>
      <label className="stack">Warranty until<input type="date" name="warrantyUntil" defaultValue={warrantyUntil} /></label>
      <label className="stack">AMC until<input type="date" name="amcUntil" defaultValue={amcUntil} /></label>
      <button className="btn">Save cover</button>
      {message && <span className="muted">{message}</span>}
    </form>
  );
}
