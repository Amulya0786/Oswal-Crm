"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="main" style={{ maxWidth: 640 }}>
      <img src="/brand/pumps-logo.png" alt="Oswal" height={72} />
      <h1>Something went wrong</h1>
      <button className="btn" onClick={() => reset()}>Try again</button>
    </main>
  );
}
