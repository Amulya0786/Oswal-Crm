"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const message = error?.message?.slice(0, 300) || "Browser error";
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  }, [error]);
  return (
    <main className="main" style={{ maxWidth: 640 }}>
      <img src="/brand/pumps-logo.png" alt="Oswal" height={72} />
      <h1>Something went wrong</h1>
      <button className="btn" onClick={() => reset()}>Try again</button>
    </main>
  );
}
