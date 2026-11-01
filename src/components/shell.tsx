"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, ClipboardList, LayoutDashboard, Library, LineChart, LogOut, Search, Settings, Shield, Upload, Wallet, Clock } from "lucide-react";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/labels";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/complaints", label: "Complaints", icon: ClipboardList },
  { href: "/masters", label: "Masters", icon: Library },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/security", label: "Security", icon: Shield },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/attendance", label: "Attendance", icon: Clock },
  { href: "/expenses", label: "Expenses", icon: Wallet },
];

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect width="48" height="48" rx="14" fill="#f4f1ea" />
      <circle cx="24" cy="24" r="8" fill="none" stroke="#c4621a" strokeWidth="2.4" />
      <path d="M24 9v6M24 33v6M9 24h6M33 24h6M14 14l4 4M30 30l4 4M34 14l-4 4M18 30l-4 4" stroke="#10243f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Shell({ user, scope, version, children }: { user: SessionUser; scope: string; version: number; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ complaints: { id: string; ticketNo: string; customerName: string; status: string }[]; customers: { id: string; name: string; phone: string }[]; engineers: { id: string; name: string }[] }>({ complaints: [], customers: [], engineers: [] });
  const accent = scope === "all" ? "#c4621a" : user.companies.find((company) => company.id === scope)?.accent ?? "#c4621a";
  const visible = NAV.filter((item) => {
    if (item.href === "/security") return user.caps.security;
    if (item.href === "/settings") return user.caps.settings;
    if (item.href === "/import") return user.caps.import;
    if (item.href === "/analytics" || item.href === "/reports") return user.caps.report || user.caps.analytics;
    if (item.href === "/masters") return user.caps.masterView;
    return true;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || q.trim().length < 2) return;
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/desk/search?q=${encodeURIComponent(q)}`);
      if (response.ok) setHits(await response.json());
    }, 160);
    return () => clearTimeout(handle);
  }, [q, open]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (path.startsWith("/complaints/book")) return;
      const active = document.activeElement?.tagName;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active)) return;
      const response = await fetch("/api/desk/live");
      if (!response.ok) return;
      const body = await response.json();
      if (body.version !== version) router.refresh();
    }, 12000);
    return () => clearInterval(timer);
  }, [path, router, version]);

  async function choose(companyId: string) {
    await fetch("/api/company", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) });
    router.refresh();
  }

  return (
    <div className="app" style={{ ["--accent" as string]: accent }}>
      <header className="mast">
        <div className="mast-top">
          <Link href="/" className="brand">
            <Mark />
            <span><strong>Oswal</strong><em>Service desk</em></span>
          </Link>
          <div className="switcher" aria-label="Company">
            {user.companies.map((company) => (
              <button key={company.id} className={scope === company.id ? "active" : ""} onClick={() => choose(company.id)}>
                <i style={{ background: company.accent }} />{company.shortName.replace("Oswal ", "")}
              </button>
            ))}
            {user.caps.allCompanies && <button className={scope === "all" ? "active" : ""} onClick={() => choose("all")}>All</button>}
          </div>
          <button className="search-btn" onClick={() => setOpen(true)}><Search size={16} /> Search <kbd>Ctrl K</kbd></button>
          <details className="user-menu">
            <summary>{user.name}<div className="muted" style={{ fontSize: 12 }}>{ROLE_LABEL[user.role]}</div></summary>
            <div className="user-pop">
              <div style={{ padding: 8 }}>{user.email}</div>
              <Link href="/exports">Exports</Link>
              <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}><LogOut size={14} /> Sign out</button>
            </div>
          </details>
        </div>
        <nav className="nav-row">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""}><Icon size={16} />{item.label}</Link>;
          })}
          <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6, alignItems: "center", color: "#b7c6d8", fontSize: 12 }}><i className="live-dot" /> Live</span>
        </nav>
      </header>
      <main className="main">{children}</main>
      {open && (
        <div className="palette" onClick={() => setOpen(false)}>
          <form onClick={(event) => event.stopPropagation()}>
            <input autoFocus placeholder="Comp. No, mobile, serial, customer, technician" value={q} onChange={(event) => setQ(event.target.value)} />
            <div>
              {hits.complaints.map((row) => <Link className="hit" key={row.id} href={`/complaints/${row.ticketNo}`} onClick={() => setOpen(false)}><b className="mono">{row.ticketNo}</b> · {row.customerName} · {row.status}</Link>)}
              {hits.customers.map((row) => <Link className="hit" key={row.id} href={`/complaints?q=${encodeURIComponent(row.phone)}`} onClick={() => setOpen(false)}>{row.name} · {row.phone}</Link>)}
              {hits.engineers.map((row) => <Link className="hit" key={row.id} href={`/complaints?engineerId=${row.id}`} onClick={() => setOpen(false)}>{row.name}</Link>)}
              {q.trim().length >= 2 && !hits.complaints.length && !hits.customers.length && !hits.engineers.length && <p className="muted">No matches yet.</p>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
