import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Phone,
  ShieldCheck,
  Smartphone,
  Smile,
  SunMedium,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";
import { DashboardCharts } from "@/components/dashboard-charts";
import { EscalateButton } from "@/components/escalate-button";
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, ROLES, labelOf } from "@/lib/constants";
import { formatDateTime, formatNumber } from "@/lib/time";
import { qs, firstParam } from "@/lib/qs";
import { can } from "@/lib/rbac";
import { requireUser } from "@/server/current-user";
import { loadDashboard } from "@/server/dashboard";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    stateId: firstParam(sp.stateId),
    districtId: firstParam(sp.districtId),
    type: firstParam(sp.type),
    technicianId: firstParam(sp.technicianId),
    productId: firstParam(sp.productId),
  };
  const [data, states, districts, products, technicians] = await Promise.all([
    loadDashboard(user, filters),
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, state: { select: { name: true } } } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "TECHNICIAN", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const base = filters;
  const href = (extra: Record<string, string | undefined>) => `/complaints${qs({ ...base, ...extra })}`;
  const cards = data.cards;

  const classic = [
    { label: "Total Pending Complaints", value: cards.totalPending, hint: "Till Now", href: href({ open: "1" }), icon: <Clock3 className="h-5 w-5" />, tone: "bg-amber-50 text-amber-700" },
    { label: "Total Open Complaints", value: cards.open, hint: "Till Now", href: href({ status: "OPEN" }), icon: <AlertTriangle className="h-5 w-5" />, tone: "bg-sky-50 text-sky-700" },
    { label: "Assigned Complaints", value: cards.assigned, hint: "Till Now", href: href({ status: "ASSIGNED,REASSIGNED" }), icon: <UserRound className="h-5 w-5" />, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Pending Complaints", value: cards.pending, hint: "Till Now", href: href({ status: "PENDING" }), icon: <Phone className="h-5 w-5" />, tone: "bg-orange-50 text-orange-700" },
    { label: "Total Login Complaints", value: cards.monthLogin, hint: "Current Month", href: href({ since: "month" }), icon: <Phone className="h-5 w-5" />, tone: "bg-slate-50 text-navy" },
    { label: "Closed Complaints", value: cards.monthClosed, hint: "Current Month", href: href({ since: "month", outcome: "closed" }), icon: <CheckCircle2 className="h-5 w-5" />, tone: "bg-teal-50 text-teal-700" },
    { label: "Happy Calling Done", value: cards.monthHappy, hint: "Current Month", href: href({ since: "month", outcome: "happy" }), icon: <Smile className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Cancelled Complaints", value: cards.monthCancelled, hint: "Current Month", href: href({ since: "month", outcome: "cancelled" }), icon: <XCircle className="h-5 w-5" />, tone: "bg-rose-50 text-rose-700" },
    { label: "Total Pending Breakdown Complaints", value: cards.breakdown, hint: "Till Now", href: href({ open: "1", type: "BREAKDOWN" }), icon: <Wrench className="h-5 w-5" />, tone: "bg-orange-50 text-orange-700" },
    { label: "Total Pending Installation Complaints", value: cards.installation, hint: "Till Now", href: href({ open: "1", type: "INSTALLATION" }), icon: <Wrench className="h-5 w-5" />, tone: "bg-sky-50 text-sky-700" },
    { label: "Total Pending Insurance Complaints", value: cards.insurance, hint: "Till Now", href: href({ open: "1", type: "INSURANCE" }), icon: <ShieldCheck className="h-5 w-5" />, tone: "bg-violet-50 text-violet-700" },
    { label: "Total Pending Mobile Application Complaints", value: cards.mobile, hint: "Till Now", href: href({ open: "1", type: "MOBILE_APP" }), icon: <Smartphone className="h-5 w-5" />, tone: "bg-cyan-50 text-cyan-700" },
    { label: "Total Pending Scheme Complaints", value: cards.scheme, hint: "MSEDCL / KUSUM · Till Now", href: href({ open: "1", type: "SCHEME" }), icon: <SunMedium className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Today Login Complaints", value: cards.todayLogin, hint: "Current day", href: href({ since: "today" }), icon: <Phone className="h-5 w-5" />, tone: "bg-slate-50 text-navy" },
    { label: "Today Closed Complaints", value: cards.todayClosed, hint: "Current day", href: href({ since: "today", outcome: "closed" }), icon: <CheckCircle2 className="h-5 w-5" />, tone: "bg-teal-50 text-teal-700" },
    { label: "Today Happy Calling Done", value: cards.todayHappy, hint: "Current day", href: href({ since: "today", outcome: "happy" }), icon: <Smile className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Today Cancelled Complaints", value: cards.todayCancelled, hint: "Current day", href: href({ since: "today", outcome: "cancelled" }), icon: <XCircle className="h-5 w-5" />, tone: "bg-rose-50 text-rose-700" },
  ];

  const labelStatus = (name: string) => labelOf(COMPLAINT_STATUSES, name);
  const labelType = (name: string) => labelOf(COMPLAINT_TYPES, name);

  return (
    <div className="space-y-5">
      {user.role === "DEALER" ? (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200">
          Dealer portal, spare orders and scheme claims arrive in Phase 3. You can book and follow complaints for your district and brand.
        </div>
      ) : null}
      <form className="card flex flex-wrap items-end gap-3 p-4" method="get">
        <Field label="State" name="stateId" value={filters.stateId} options={states.map((state) => ({ value: state.id, label: state.name }))} />
        <Field label="District" name="districtId" value={filters.districtId} options={districts.map((district) => ({ value: district.id, label: `${district.name}, ${district.state.name}` }))} />
        <Field label="Type" name="type" value={filters.type} options={COMPLAINT_TYPES.map((type) => ({ value: type.value, label: type.label }))} />
        <Field label="Technician" name="technicianId" value={filters.technicianId} options={technicians.map((tech) => ({ value: tech.id, label: tech.name }))} />
        <Field label="Product" name="productId" value={filters.productId} options={products.map((product) => ({ value: product.id, label: product.name }))} />
        <button className="btn btn-navy">Apply</button>
        <Link href="/" className="btn btn-ghost">Reset</Link>
        {can(user.role, "runEscalation") ? <EscalateButton /> : null}
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {classic.map((card) => (
          <Link key={card.label} href={card.href} className="card stripe relative min-h-[132px] overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="text-sm leading-snug text-muted">{card.label}</div>
                <div className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-navy">{formatNumber(card.value)}</div>
                <div className="mt-1 text-xs text-muted">{card.hint}</div>
              </div>
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${card.tone}`}>{card.icon}</div>
            </div>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-navy">Ageing and SLA</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["0–2 days", cards.age02, "0-2"],
            ["3–7 days", cards.age37, "3-7"],
            ["8–15 days", cards.age815, "8-15"],
            ["15+ days", cards.age15, "15+"],
          ].map(([label, value, bucket]) => (
            <Link key={bucket} href={href({ open: "1", age: String(bucket) })} className="card p-4 hover:-translate-y-0.5 hover:shadow-lg">
              <div className="text-sm text-muted">{label}</div>
              <div className="mt-1 font-display text-3xl font-semibold tabular-nums">{formatNumber(Number(value))}</div>
              <div className="text-xs text-muted">{bucket === "15+" ? "Open more than 15 days" : "Open complaints"}</div>
            </Link>
          ))}
          <Link href={href({ sla: "response" })} className="card p-4 ring-1 ring-rose-100 hover:-translate-y-0.5">
            <div className="text-sm text-rose-700">Response SLA breaches</div>
            <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-rose-700">{formatNumber(cards.responseBreach)}</div>
            <div className="text-xs text-muted">Still unassigned past the response clock</div>
          </Link>
          <Link href={href({ sla: "close" })} className="card p-4 ring-1 ring-rose-100 hover:-translate-y-0.5">
            <div className="text-sm text-rose-700">Closing SLA breaches</div>
            <div className="mt-1 font-display text-3xl font-semibold tabular-nums text-rose-700">{formatNumber(cards.closeBreach)}</div>
            <div className="text-xs text-muted">Open past the closing clock</div>
          </Link>
        </div>
      </section>

      <DashboardCharts
        status={data.byStatus.map((point) => ({ name: labelStatus(point.name), value: point.value, href: href({ status: point.name }) }))}
        types={data.byType.map((point) => ({ name: labelType(point.name), value: point.value, href: href({ open: "1", type: point.name }) }))}
        ageing={data.ageing.map((point) => ({ name: point.name, value: point.value, href: href({ open: "1", age: point.name }) }))}
        districts={data.byDistrict.map((point) => ({ name: point.name, value: point.value, href: href({ open: "1", districtId: point.id }) }))}
        trend={data.trend.map((point) => ({ ...point, href: "/" }))}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="font-display text-base font-semibold text-navy">Latest outbound messages</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {data.notifications.length === 0 ? <li className="py-3 text-muted">Messages appear here as complaints are booked and closed.</li> : null}
            {data.notifications.map((row) => (
              <li key={row.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-navy">{row.event} · {row.channel}</span>
                  <span className="text-xs text-muted">{formatDateTime(row.createdAt)}</span>
                </div>
                <div className="text-muted">{row.complaint?.ticketNumber ?? "—"} · {row.status} · {row.provider}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4">
          <h2 className="font-display text-base font-semibold text-navy">Escalation log</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {data.escalations.length === 0 ? <li className="py-3 text-muted">No escalations yet. Run the job when an SLA is breached.</li> : null}
            {data.escalations.map((row) => (
              <li key={row.id} className="py-2">
                <Link href={`/complaints/${row.complaint.id}`} className="font-semibold text-navy hover:underline">{row.complaint.ticketNumber}</Link>
                <div className="text-muted">
                  To {labelOf(ROLES, row.toRole)}{row.toUser ? ` · ${row.toUser.name}` : ""} · {formatDateTime(row.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Field({ label, name, value, options }: { label: string; name: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label className="block min-w-[10rem] flex-1">
      <span className="label">{label}</span>
      <select className="field" name={name} defaultValue={value ?? ""}>
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
