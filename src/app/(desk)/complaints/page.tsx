import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { listComplaints } from "@/server/query";
import { filtersFromRecord } from "@/server/scope";
import { ComplaintTable, SaveView } from "@/components/complaint-tools";
import { CALL_TYPES, STATUSES } from "@/lib/labels";
import { formatNumber } from "@/lib/time";

export const metadata = { title: "Complaints" };

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const sp = await searchParams;
  const filters = filtersFromRecord(sp);
  const [data, states, engineers, problems, solutions, views] = await Promise.all([
    listComplaints(user, scope, filters),
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.engineer.findMany({ where: scope === "all" ? { active: true } : { active: true, companyId: scope }, orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
    prisma.actualProblem.findMany({ orderBy: { name: "asc" }, take: 30 }),
    prisma.actualSolution.findMany({ orderBy: { name: "asc" }, take: 30 }),
    prisma.savedView.findMany({ where: { userId: user.id, entity: "complaints" }, orderBy: { name: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const query = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) if (typeof value === "string" && key !== "page") params.set(key, value);
    params.set("page", String(page));
    return `/complaints?${params.toString()}`;
  };
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Complaint register</p>
          <h1>{formatNumber(data.total)} complaints</h1>
          <p>Page {data.page} of {pages}. Search and filters run on the server.</p>
        </div>
        {user.caps.book && <Link className="btn" href="/complaints/book">Book</Link>}
      </div>
      <form className="filters" action="/complaints">
        <input name="q" defaultValue={filters.q ?? ""} placeholder="Comp. No, mobile, serial, name" />
        <select name="status" defaultValue={filters.status ?? ""}><option value="">Any status</option>{STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <select name="callType" defaultValue={filters.callType ?? ""}><option value="">Any call type</option>{CALL_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
        <select name="stateId" defaultValue={filters.stateId ?? ""}><option value="">Any state</option>{states.map((state) => <option key={state.id} value={state.id}>{state.name}</option>)}</select>
        <select name="priority" defaultValue={filters.priority ?? ""}><option value="">Any priority</option><option>LOW</option><option>NORMAL</option><option>HIGH</option><option>URGENT</option></select>
        <input type="date" name="from" defaultValue={filters.from ?? ""} />
        <input type="date" name="to" defaultValue={filters.to ?? ""} />
        <button className="btn" type="submit">Apply</button>
        </form>
      <div className="chips">
        {views.map((view) => {
          const saved = JSON.parse(view.filters) as Record<string, string>;
          const params = new URLSearchParams(saved);
          return <Link className="chip" key={view.id} href={`/complaints?${params.toString()}`}>{view.name}</Link>;
        })}
        <SaveView />
      </div>
      {data.capped && <div className="banner">Deep pages are capped. Narrow the filters or export the full match.</div>}
      <ComplaintTable rows={data.rows} engineers={engineers} problems={problems} solutions={solutions} can={user.caps} />
      <div className="pager">
        {data.page > 1 && <Link className="btn line" href={query(data.page - 1)}>Previous</Link>}
        <span className="muted">{data.page} / {pages}</span>
        {data.page < pages && <Link className="btn line" href={query(data.page + 1)}>Next</Link>}
      </div>
    </div>
  );
}

