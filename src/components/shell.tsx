"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Ticket,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import { NAV, type NavItem } from "@/config/nav";
import { ROLES, labelOf } from "@/lib/constants";
import { can } from "@/lib/rbac";

const ICONS = {
  dashboard: LayoutDashboard,
  masters: Database,
  complaint: Ticket,
  attendance: CalendarCheck,
  expenses: Wallet,
  reports: BarChart3,
  security: Shield,
  import: Upload,
  settings: Settings,
};

export function Shell({
  user,
  children,
}: {
  user: { name: string; role: string; employeeCode: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((item) => {
    if (item.href === "/security") return can(user.role, "manageUsers");
    if (item.href === "/import") return can(user.role, "importData");
    if (item.href === "/settings") return can(user.role, "manageSla");
    if (item.href === "/reports") return can(user.role, "viewReports");
    return true;
  });

  return (
    <div className="min-h-screen lg:flex">
      <Side items={items} pathname={pathname} className="sticky top-0 hidden h-screen w-64 shrink-0 lg:flex" />
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-navy/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <Side items={items} pathname={pathname} className="relative z-10 flex h-full w-72" onNavigate={() => setOpen(false)} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
            <button className="btn btn-ghost px-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-[10rem]">
              <div className="text-xs text-muted">Welcome</div>
              <div className="font-display text-sm font-semibold leading-tight text-navy">{user.name}</div>
              <div className="text-xs text-muted">
                {user.employeeCode} · {labelOf(ROLES, user.role)}
              </div>
            </div>
            <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
              <Link href="/reports/state-tickets" className="btn btn-accent">
                State Ticket Counter
              </Link>
              <Link href="/reports/brand-tickets" className="btn btn-accent">
                Brand Ticket Counter
              </Link>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {can(user.role, "book") ? (
                <Link href="/complaints/book" className="btn btn-navy">
                  Book complaint
                </Link>
              ) : null}
              <button
                className="btn btn-ghost"
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>
        <main className="px-4 py-5 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}

function Side({
  items,
  pathname,
  className,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  className: string;
  onNavigate?: () => void;
}) {
  return (
    <aside className={`${className} flex-col bg-navy text-white`}>
      <div className="flex items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent font-display text-sm font-bold text-white">OP</span>
          <span>
            <span className="block font-display text-base font-semibold leading-none">Oswal Pumps</span>
            <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] text-white/60">SERVICE CRM</span>
          </span>
        </Link>
        {onNavigate ? (
          <button className="rounded-lg p-1 text-white/70 lg:hidden" onClick={onNavigate} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.phase > 1 ? <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">P{item.phase}</span> : null}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 text-xs text-white/50">
        <div>Version 1.0.0 · Phase 1</div>
        <div className="mt-1">© 2026 Oswal Pumps Ltd, Karnal</div>
      </div>
    </aside>
  );
}
