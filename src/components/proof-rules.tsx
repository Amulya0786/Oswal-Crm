"use client";

import { useState } from "react";
import { CALL_TYPES } from "@/lib/labels";

export function ProofRules() {
  const [message, setMessage] = useState("");
  return (
    <section className="panel stack">
      <h2>What a close must include</h2>
      <p className="muted">Photo, signature or OTP, and GPS. A pin farther than the kilometre limit is flagged. Happy call on the desk stays available when WhatsApp is not used.</p>
      {CALL_TYPES.map((type) => (
        <form key={type.id} className="filters" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const response = await fetch("/api/desk/proof", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              callType: type.id,
              requirePhoto: form.get("photo") === "on",
              requireIdentity: form.get("identity") === "on",
              requireGps: form.get("gps") === "on",
              maxKm: Number(form.get("maxKm") || 15),
            }),
          });
          setMessage(response.ok ? `${type.label} saved.` : "Could not save");
        }}>
          <b>{type.label}</b>
          <label><input name="photo" type="checkbox" defaultChecked /> Photo</label>
          <label><input name="identity" type="checkbox" defaultChecked /> Signature or OTP</label>
          <label><input name="gps" type="checkbox" defaultChecked /> GPS</label>
          <input name="maxKm" type="number" defaultValue={15} />
          <button className="btn line">Save</button>
        </form>
      ))}
      {message && <p>{message}</p>}
    </section>
  );
}
