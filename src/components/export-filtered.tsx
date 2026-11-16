"use client";

import { useState } from "react";
import { showToast } from "@/components/toast";

export function ExportFiltered() {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn line" disabled={busy} onClick={async (event) => {
      const form = event.currentTarget.form;
      if (!form) return;
      setBusy(true);
      const filters = Object.fromEntries(new FormData(form).entries());
      const response = await fetch("/api/desk/exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filters, format: "xlsx" }) });
      setBusy(false);
      if (!response.ok) {
        showToast("Export failed");
        return;
      }
      window.location.href = "/exports";
    }}>{busy ? "Exporting…" : "Export data"}</button>
  );
}
