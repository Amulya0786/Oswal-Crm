"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/chrome";

type Row = { name: string; closures: number; score: number; incentive: number };
type Card = { label: string; tickets: number; closed: number; closureRate: number; tatHours: number | null; firstTimeFix: number; repeatRate: number; feedback: number | null };

export default function PerformancePage() {
  const [tab, setTab] = useState<"board" | "cards">("board");
  const [rows, setRows] = useState<Row[]>([]);
  const [slabs, setSlabs] = useState<{ min: number; amount: number }[]>([]);
  const [cards, setCards] = useState<{ technicians: Card[]; districts: Card[]; states: Card[] } | null>(null);

  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("tab");
    if (asked === "cards") setTab("cards");
    void fetch("/api/desk/performance").then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      setRows(body.rows ?? []);
      setSlabs(body.slabs ?? []);
    });
    void fetch("/api/desk/scorecards").then(async (response) => {
      if (response.ok) setCards(await response.json());
    });
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Reports</p>
          <h1>Technician score</h1>
          <p>One place for the weighted score and the detailed scorecards.</p>
        </div>
        {tab === "cards" && (
          <span className="row-actions">
            <a className="btn line" href="/api/desk/scorecards?format=xlsx">Excel</a>
            <a className="btn line" href="/api/desk/scorecards?format=pdf">PDF</a>
          </span>
        )}
      </div>
      <div className="chips">
        <button type="button" className={`chip ${tab === "board" ? "on" : ""}`} onClick={() => setTab("board")}>Leaderboard and incentives</button>
        <button type="button" className={`chip ${tab === "cards" ? "on" : ""}`} onClick={() => setTab("cards")}>Scorecards</button>
      </div>
      {tab === "board" && (
        <>
          {!rows.length && <EmptyState title="No technician scores yet" body="Scores appear after visits are closed. The sheet stays empty while the register is empty." />}
          {!!rows.length && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Technician</th><th className="num">Score</th><th className="num">Closures</th><th className="num">Incentive</th></tr></thead>
                <tbody>{rows.map((row) => <tr key={row.name}><td>{row.name}</td><td className="num">{row.score}</td><td className="num">{row.closures}</td><td className="num">{row.incentive}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <section className="panel" style={{ marginTop: 12 }}>
            <h2>Incentive slabs</h2>
            {slabs.map((slab) => <p key={slab.min}>Score {slab.min} and above: ₹{slab.amount}</p>)}
          </section>
        </>
      )}
      {tab === "cards" && (
        <>
          {!cards?.technicians.length && !cards?.districts.length && <EmptyState title="No scorecard rows yet" body="Technicians, districts and states appear here after complaints are booked and closed." />}
          <ScoreTable title="Technicians" rows={cards?.technicians ?? []} />
          <ScoreTable title="Districts" rows={cards?.districts ?? []} />
          <ScoreTable title="States" rows={cards?.states ?? []} />
        </>
      )}
    </div>
  );
}

function ScoreTable({ title, rows }: { title: string; rows: Card[] }) {
  if (!rows.length) return null;
  return (
    <section className="panel" style={{ marginTop: 12 }}>
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th className="num">Tickets</th><th className="num">Closed</th><th className="num">Closure %</th><th className="num">TAT h</th><th className="num">First-time fix %</th><th className="num">Repeat %</th><th className="num">Feedback</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td><td className="num">{row.tickets}</td><td className="num">{row.closed}</td><td className="num">{row.closureRate}</td>
                <td className="num">{row.tatHours ?? "—"}</td><td className="num">{row.firstTimeFix}</td><td className="num">{row.repeatRate}</td><td className="num">{row.feedback ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
