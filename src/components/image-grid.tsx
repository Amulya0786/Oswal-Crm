"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMAGE_SLOTS } from "@/lib/image-slots";
import { showToast } from "@/components/toast";

type SlotFile = { id: string; name: string; source: "media" | "attachment" } | null;

export function ImageGrid({ complaintId, files, canUpload }: { complaintId: string; files: Record<string, SlotFile>; canUpload: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const filled = IMAGE_SLOTS.filter((slot) => files[slot.id]);

  async function upload(slot: string, list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    setBusy(slot);
    const body = new FormData();
    body.set("complaintId", complaintId);
    body.set("slot", slot);
    body.set("file", file);
    const response = await fetch("/api/desk/media", { method: "POST", body });
    setBusy("");
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      showToast(payload.error ?? "Could not upload");
      return;
    }
    router.refresh();
  }

  function href(file: NonNullable<SlotFile>, download: boolean) {
    const base = file.source === "media" ? `/api/desk/media/${file.id}` : `/api/desk/attachments/${file.id}`;
    return download ? `${base}?download=1` : base;
  }

  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <div className="page-head">
        <h2>Photos</h2>
        {filled.length > 0 && <a className="btn line" href={`/api/desk/media-pack/${complaintId}`}>Download all</a>}
      </div>
      <div className="cards">
        {IMAGE_SLOTS.map((slot) => {
          const file = files[slot.id];
          return (
            <div key={slot.id} className="panel stack">
              <b>{slot.label}</b>
              {file ? (
                <>
                  <a href={href(file, false)} target="_blank" rel="noreferrer">View</a>
                  <a href={href(file, true)}>Download</a>
                </>
              ) : canUpload ? (
                <label className="stack">Upload<input type="file" accept="image/*" aria-label={`Upload ${slot.label}`} disabled={busy === slot.id} onChange={(event) => void upload(slot.id, event.target.files)} /></label>
              ) : <span className="muted">Empty</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
