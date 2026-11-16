import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { listComplaints } from "@/server/query";
import { filtersFromRecord } from "@/server/scope";
import { ComplaintFeed, SaveView } from "@/components/complaint-tools";
import { CALL_TYPES, SOURCES, STATUSES } from "@/lib/labels";
import { PORTALS } from "@/lib/portal";
import { ExportFiltered } from "@/components/export-filtered";
import { formatNumber } from "@/lib/time";
import { ImportBanner } from "@/components/import-banner";
import { cookies } from "next/headers";
import { phrase } from "@/lib/desk-copy";

export const metadata = { title: "Complaints" };

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const sp = await searchParams;
  const filters = filtersFromRecord(sp);
  if (!filters.stateId && typeof sp.state === "string") {
    const named = await prisma.state.findFirst({ where: { name: { equals: sp.state, mode: "insensitive" } }, select: { id: true } });
    if (named) filters.stateId = named.id;
  }
  const [data, states, districts, engineers, problems, solutions, categories, products, issues, views] = await Promise.all([
    listComplaints(user, scope, filters),
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.district.findMany({ where: { active: true, ...(filters.stateId ? { stateId: filters.stateId } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 400 }),
    prisma.engineer.findMany({ where: scope === "all" ? { active: true } : { active: true, companyId: scope }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
    prisma.actualProblem.findMany({ orderBy: { name: "asc" }, take: 30 }),
    prisma.actualSolution.findMany({ orderBy: { name: "asc" }, take: 30 }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 300 }),
    prisma.complaintIssue.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
    prisma.savedView.findMany({ where: { userId: user.id, entity: "complaints" }, orderBy: { name: "asc" } }),
  ]);
  const search = new URLSearchParams(Object.entries(sp).flatMap(([key, value]) => typeof value === "string" && key !== "page" && key !== "cursor" ? [[key, value]] : [])).toString();
  const lang = (await cookies()).get("oswal_lang")?.value === "hi" ? "hi" : "en";
  const t = (text: string) => phrase(lang, text);
  return (
    <div>
      <ImportBanner />
      <div className="page-head">
        <div>
          <p className="kicker">Complaint register</p>
          <h1>{t("Complaints")} · {formatNumber(data.total)}</h1>
        </div>
        {user.caps.book && <Link className="btn" href="/complaints/book">{t("Book")}</Link>}
      </div>
      <form className="filters" action="/complaints" id="complaint-filters">
        {filters.reassigned === "1" && <input type="hidden" name="reassigned" value="1" />}
        {typeof sp.advanced === "string" && <input type="hidden" name="advanced" value="1" />}
        <label className="stack">{t("Search")}<input name="q" aria-label={t("Search")} defaultValue={filters.q ?? ""} autoFocus={sp.advanced === "1"} placeholder="Ticket, name, phone, Saral, portal no, MSEDCL request" /></label>
        <label className="stack">{t("Status")}<select name="status" aria-label={t("Status")} defaultValue={filters.status ?? ""}><option value="">{t("Any status")}</option>{STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="stack">Hold<select name="hold" aria-label="Hold status" defaultValue={filters.hold ?? ""}><option value="">Any hold</option><option value="1">On hold</option><option value="0">Not on hold</option></select></label>
        <label className="stack">{t("Call type")}<select name="callType" aria-label={t("Call type")} defaultValue={filters.callType ?? ""}><option value="">{t("Any call type")}</option>{CALL_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="stack">Category<select name="categoryId" aria-label="Category" defaultValue={filters.categoryId ?? ""}><option value="">Any category</option>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="stack">Product<select name="productId" aria-label="Product" defaultValue={filters.productId ?? ""}><option value="">Any product</option>{products.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="stack">Nature<select name="natureId" aria-label="Nature of complaint" defaultValue={filters.natureId ?? ""}><option value="">Any nature</option>{issues.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="stack">Source<select name="source" aria-label="Complaint source" defaultValue={filters.source ?? ""}><option value="">Any source</option>{SOURCES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="stack">Engineer<select name="engineerId" aria-label="Engineer" defaultValue={filters.engineerId ?? ""}><option value="">Any engineer</option>{engineers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="stack">{t("State")}<select name="stateId" aria-label={t("State")} defaultValue={filters.stateId ?? ""}><option value="">{t("Any state")}</option>{states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select></label>
        <label className="stack">City / district<select name="districtId" aria-label="City or district" defaultValue={filters.districtId ?? ""}><option value="">Any city or district</option>{districts.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label className="stack">{t("Priority")}<select name="priority" aria-label={t("Priority")} defaultValue={filters.priority ?? ""}><option value="">{t("Any priority")}</option><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select></label>
        <label className="stack">Portal<select name="portal" aria-label="Portal" defaultValue={filters.portal ?? ""}><option value="">Any portal</option>{PORTALS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="stack">Dates<select name="dateOn" aria-label="Date field" defaultValue={filters.dateOn ?? "book"}><option value="book">Book date</option><option value="schedule">Schedule date</option></select></label>
        <label className="stack">{t("From")}<input name="from" aria-label={t("From")} placeholder="dd/mm/yyyy" defaultValue={filters.from ?? ""} /></label>
        <label className="stack">{t("To")}<input name="to" aria-label={t("To")} placeholder="dd/mm/yyyy" defaultValue={filters.to ?? ""} /></label>
        <label className="stack">{t("Name")}<select name="nameReview" aria-label={t("Name")} defaultValue={filters.nameReview ?? ""}><option value="">{t("Any name")}</option><option value="1">{t("Name needs review")}</option></select></label>
        <button className="btn" type="submit">{t("Apply")}</button>
        {user.caps.export && <ExportFiltered />}
        </form>
      <div className="chips">
        {views.map((view) => {
          const saved = JSON.parse(view.filters) as Record<string, string>;
          const params = new URLSearchParams(saved);
          return <Link className="chip" key={view.id} href={`/complaints?${params.toString()}`}>{view.name}</Link>;
        })}
        <SaveView />
      </div>
      <ComplaintFeed key={search} initial={data.rows} nextCursor={data.nextCursor} search={search} engineers={engineers} problems={problems} solutions={solutions} can={user.caps} />
    </div>
  );
}

