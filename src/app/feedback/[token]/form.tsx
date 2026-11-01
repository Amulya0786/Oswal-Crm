"use client";

import { useState } from "react";

export function FeedbackForm({ token }: { token: string }) {
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/feedback/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, notes }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Could not save feedback.");
      return;
    }
    setDone(true);
  }

  if (done) return <p className="mt-4 text-sm">Thank you. Your rating has been recorded.</p>;

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label>
        <span className="label">Rating</span>
        <select className="field" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}
        </select>
      </label>
      <label>
        <span className="label">Comment</span>
        <textarea className="field min-h-24" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button className="btn btn-accent">Send feedback</button>
    </form>
  );
}
