"use client";

import { useState } from "react";

export function TrackRating({ token, pending, rating }: { token: string; pending: boolean; rating: number | null }) {
  const [done, setDone] = useState(rating != null);
  const [error, setError] = useState("");
  if (done && rating) return <p>You rated this visit {rating}/5.</p>;
  if (!pending && !rating) return <p className="muted">A rating opens after the visit is closed.</p>;
  return (
    <form className="stack" onSubmit={async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/public/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, rating: Number(data.get("rating")), comment: data.get("comment") }),
      });
      const body = await response.json();
      if (!response.ok) setError(body.error ?? "Could not save");
      else setDone(true);
    }}>
      <p>Rate the visit from 1 to 5.</p>
      <select name="rating" defaultValue="5">{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select>
      <input name="comment" placeholder="Optional comment" />
      <button className="btn">Send rating</button>
      {error && <div className="banner bad">{error}</div>}
      {done && <p>Thank you.</p>}
    </form>
  );
}
