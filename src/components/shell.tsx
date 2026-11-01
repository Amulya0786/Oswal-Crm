"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, ClipboardList, Clock, LayoutDashboard, Library, LineChart, LogOut, Map as MapIcon, PanelLeft, Search, Settings, Shield, Upload, Users } from "lucide-react";
import type { SessionUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/labels";
import { DESK_LABEL, type FieldLang } from "@/lib/i18n";
import { BrandLogo, PageTransition, ThemeToggle } from "@/components/chrome";

const GROUPS = [
  { label: "Desk", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Service", items: [
    { href: "/complaints", label: "Complaints", icon: ClipboardList },
    { href: "/customers", label: "Customers", icon: Users },
    { href: "/map", label: "Map", icon: MapIcon },
    { href: "/attendance", label: "Attendance", icon: Clock },
  ] },
  { label: "Masters", items: [{ href: "/masters", label: "Masters", icon: Library }] },
  { label: "Reports", items: [
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/performance", label: "Technician score", icon: BarChart3 },
    { href: "/reports/daily", label: "Daily summary", icon: LineChart },
    { href: "/assist", label: "Suggestions", icon: LineChart },
  ] },
  { label: "Admin", items: [
    { href: "/security", label: "Security", icon: Shield },
    { href: "/import", label: "Import", icon: Upload },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/connect", label: "Power BI", icon: BarChart3 },
  ] },
];

const CRUMB: Record<string, string> = {
  complaints: "Complaints", book: "Book", masters: "Masters", reports: "Reports", analytics: "Analytics",
  security: "Security", import: "Import", settings: "Settings", attendance: "Attendance",
  exports: "Exports", customers: "Customers", assets: "Asset", map: "Map", whatsapp: "WhatsApp", scorecards: "Technician score", daily: "Daily summary", field: "Technician", assist: "Suggestions", performance: "Technician score", feedback: "Ratings", connect: "Power BI",
};

export function Shell({ user, scope, version, children }: { user: SessionUser; scope: string; version: number; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ complaints: { id: string; ticketNo: string; customerName: string; status: string }[]; customers: { id: string; name: string; phone: string }[]; engineers: { id: string; name: string }[] }>({ complaints: [], customers: [], engineers: [] });
  const current = user.companies.find((company) => company.id === scope);
  const logo = current?.code === "SOLAR" ? "SOLAR" : "PUMPS";

  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.href === "/security" || item.href === "/import" || item.href === "/settings" || item.href === "/connect") return user.caps.security;
      if (item.href === "/reports" || item.href === "/performance" || item.href === "/reports/daily") return user.caps.report || user.caps.analytics;
      if (item.href === "/masters") return user.caps.masterView;
      return true;
    }),
  })).filter((group) => group.items.length);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("oswal-sidebar") === "collapsed");
    const saved = window.localStorage.getItem("oswal-lang");
    if (saved === "hi" || saved === "en") {
      setLang(saved);
      document.cookie = `oswal_lang=${saved}; path=/; max-age=31536000`;
    }
  }, []);

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

  const trail = [{ href: "/", label: "Desk" }];
  let built = "";
  for (const part of path.split("/").filter(Boolean)) {
    built += `/${part}`;
    trail.push({ href: built, label: CRUMB[part] ?? decodeURIComponent(part) });
  }

  return (
    <div className={`app ${collapsed ? "collapsed" : ""}`}>
      <header className="topband">
        <div className="topband-row">
          <button type="button" className="icon-btn" aria-label="Collapse sidebar" onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            window.localStorage.setItem("oswal-sidebar", next ? "collapsed" : "open");
          }}><PanelLeft size={16} /></button>
          <div className="switcher" aria-label="Company">
            {user.companies.map((company) => (
              <button key={company.id} className={scope === company.id ? "active" : ""} onClick={() => choose(company.id)}>
                <i style={{ background: company.accent }} />{company.shortName.replace("Oswal ", "")}
              </button>
            ))}
            {user.caps.allCompanies && <button className={scope === "all" ? "active" : ""} onClick={() => choose("all")}>All</button>}
          </div>
          <button className="search-btn" onClick={() => setOpen(true)}><Search size={16} /> Search <kbd>Ctrl K</kbd></button>
          <button type="button" className="icon-btn" aria-label="Language" onClick={() => {
            const next = lang === "hi" ? "en" : "hi";
            setLang(next);
            window.localStorage.setItem("oswal-lang", next);
            document.cookie = `oswal_lang=${next}; path=/; max-age=31536000`;
            document.documentElement.lang = next;
          }}>{lang === "hi" ? "EN" : "हिंदी"}</button>
          <ThemeToggle />
          <span className="live-dot" title="Live" />
          <details className="user-menu">
            <summary>{user.name}<div className="muted" style={{ fontSize: 12, color: "#d5e7dc" }}>{ROLE_LABEL[user.role]}</div></summary>
            <div className="user-pop">
              <div style={{ padding: 8 }}>{user.email}</div>
              <Link href="/exports">{DESK_LABEL[lang].Exports}</Link>
              <Link href="/field">{DESK_LABEL[lang]["Technician app"]}</Link>
              <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}><LogOut size={14} /> {DESK_LABEL[lang]["Sign out"]}</button>
            </div>
          </details>
        </div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <Link href="/" className="side-brand" aria-label="Oswal">
            <BrandLogo company={logo} collapsed={collapsed} />
          </Link>
          {groups.map((group) => (
            <div key={group.label}>
              <div className="side-group">{DESK_LABEL[lang][group.label] ?? group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === "/"
                  ? path === "/"
                  : item.href === "/reports"
                    ? path === "/reports" || (path.startsWith("/reports/") && !path.startsWith("/reports/daily"))
                    : path.startsWith(item.href);
                const label = DESK_LABEL[lang][item.label] ?? item.label;
                return <Link key={item.href} href={item.href} className={`side-link ${active ? "active" : ""}`}><Icon size={16} /><span>{label}</span></Link>;
              })}
            </div>
          ))}
        </aside>
        <main className="main">
          <nav className="crumbs" aria-label="Breadcrumb">
            {trail.map((item, index) => (
              <span key={item.href}>
                {index > 0 && " / "}
                {index === trail.length - 1 ? (DESK_LABEL[lang][item.label] ?? item.label) : <Link href={item.href}>{DESK_LABEL[lang][item.label] ?? item.label}</Link>}
              </span>
            ))}
          </nav>
          <PageTransition path={path}>{children}</PageTransition>
        </main>
      </div>
      {open && (
        <div className="palette" onClick={() => setOpen(false)}>
          <form onClick={(event) => event.stopPropagation()}>
            <input autoFocus placeholder="Comp. No, mobile, serial, customer, technician" value={q} onChange={(event) => setQ(event.target.value)} />
            <div>
              {hits.complaints.map((row) => <Link className="hit" key={row.id} href={`/complaints/${row.ticketNo}`} onClick={() => setOpen(false)}><b className="mono">{row.ticketNo}</b> · {row.customerName} · {row.status}</Link>)}
              {hits.customers.map((row) => <Link className="hit" key={row.id} href={`/customers/${row.id}`} onClick={() => setOpen(false)}>{row.name} · {row.phone}</Link>)}
              {hits.engineers.map((row) => <Link className="hit" key={row.id} href={`/complaints?engineerId=${row.id}`} onClick={() => setOpen(false)}>{row.name}</Link>)}
              {q.trim().length >= 2 && !hits.complaints.length && !hits.customers.length && !hits.engineers.length && <p className="muted">No matches yet.</p>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
