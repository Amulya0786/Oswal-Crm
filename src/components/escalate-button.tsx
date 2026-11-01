"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EscalateButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function run() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/jobs/escalate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; escalated?: number; scanned?: number };
    if (!response.ok) {
      setMessage(data.error ?? "Escalation did not run.");
      setPending(false);
      return;
    }
    setMessage(`Escalated ${data.escalated} of ${data.scanned} open complaints by one level.`);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button className="btn btn-navy" onClick={run} disabled={pending}>
        {pending ? "Running…" : "Run escalation"}
      </button>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
