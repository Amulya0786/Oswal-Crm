import Link from "next/link";
import { PageHeader, StatusBadge, TypeBadge, Empty } from "@/components/ui";
import { AGE_BUCKETS, COMPLAINT_SOURCES, COMPLAINT_STATUSES, COMPLAINT_TYPES, labelOf } from "@/lib/constants";
import { ageInDays, formatDateTime } from "@/lib/time";
import { firstParam, qs } from "@/lib/qs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";
import { listComplaints } from "@/server/complaints";
import { isBreached } from "@/lib/sla";

export const metadata = { title: "Complaints" };

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    q: firstParam(sp.q),
    status: firstParam(sp.status),
    type: firstParam(sp.type),
    source: firstParam(sp.source),
    stateId: firstParam(sp.stateId),
    districtId: firstParam(sp.districtId),
    technicianId: firstParam(sp.technicianId),
    productId: firstParam(sp.productId),
    age: firstParam(sp.age),
    sla: firstParam(sp.sla),
    open: firstParam(sp.open),
    scheme: firstParam(sp.scheme),
    since: firstParam(sp.since),
    outcome: firstParam(sp.outcome),
    from: firstParam(sp.from),
    to: firstParam(sp.to),
    page: Number(firstParam(sp.page) ?? "1") || 1,
  };
  const [result, states, districts] = await Promise.all([
    listComplaints(user, filters),
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const preserved = { ...filters, page: undefined };

  return (
    <div>
      <PageHeader title="Complaints" subtitle={`${result.total.toLocaleString("en-IN")} complaints in this view. Open a ticket to assign, hold, close or record happy calling.`} actions={<Link href="/complaints/book" className="btn btn-accent">Book complaint</Link>} />
      <form className="card mb-4 grid gap-3 p-4 md:grid-cols-4" method="get">
        <label className="md:col-span-2">
          <span className="label">Search ticket, phone or name</span>
          <input className="field" name="q" defaultValue={filters.q ?? ""} placeholder="OPL10001 or 98110…" />
        </label>
        <Select label="Status" name="status" value={filters.status} options={[{ value: "ASSIGNED,REASSIGNED", label: "Assigned + re-assigned" }, ...COMPLAINT_STATUSES.map((item) => ({ value: item.value, label: item.label }))]} />
        <Select label="Type" name="type" value={filters.type} options={COMPLAINT_TYPES.map((item) => ({ value: item.value, label: item.label }))} />
        <Select label="Source" name="source" value={filters.source} options={COMPLAINT_SOURCES.map((item) => ({ value: item.value, label: item.label }))} />
        <Select label="State" name="stateId" value={filters.stateId} options={states.map((state) => ({ value: state.id, label: state.name }))} />
        <Select label="District" name="districtId" value={filters.districtId} options={districts.map((district) => ({ value: district.id, label: district.name }))} />
        <Select label="Ageing" name="age" value={filters.age} options={AGE_BUCKETS.map((item) => ({ value: item.value, label: item.label }))} />
        <Select label="SLA" name="sla" value={filters.sla} options={[{ value: "any", label: "Any breach" }, { value: "response", label: "Response breach" }, { value: "close", label: "Closing breach" }]} />
        <label>
          <span className="label">From</span>
          <input className="field" type="date" name="from" defaultValue={filters.from?.slice(0, 10) ?? ""} />
        </label>
        <label>
          <span className="label">To</span>
          <input className="field" type="date" name="to" defaultValue={filters.to?.slice(0, 10) ?? ""} />
        </label>
        {filters.open ? <input type="hidden" name="open" value={filters.open} /> : null}
        {filters.since ? <input type="hidden" name="since" value={filters.since} /> : null}
        {filters.outcome ? <input type="hidden" name="outcome" value={filters.outcome} /> : null}
        {filters.technicianId ? <input type="hidden" name="technicianId" value={filters.technicianId} /> : null}
        {filters.productId ? <input type="hidden" name="productId" value={filters.productId} /> : null}
        {filters.scheme ? <input type="hidden" name="scheme" value={filters.scheme} /> : null}
        <div className="flex items-end gap-2 md:col-span-2">
          <button className="btn btn-navy">Search</button>
          <Link href="/complaints" className="btn btn-ghost">Clear</Link>
        </div>
      </form>

      {result.rows.length === 0 ? <Empty title="No complaints match" body="Try another filter, or book a new complaint." /> : (
        <>
          <div className="card hidden overflow-x-auto md:block">
            <table className="data">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Logged</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>District</th>
                  <th>Assignee</th>
                  <th>Age</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td><Link className="font-semibold text-navy hover:underline" href={`/complaints/${row.id}`}>{row.ticketNumber}</Link></td>
                    <td className="whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                    <td>
                      <div>{row.customer.name}</div>
                      <div className="text-xs text-muted">{row.customer.phone}</div>
                    </td>
                    <td><TypeBadge type={row.type} /></td>
                    <td><StatusBadge status={row.status} /></td>
                    <td>{row.district?.name ?? "—"}</td>
                    <td>{row.assignedTo?.name ?? row.serviceCenter?.engineerName ?? "—"}</td>
                    <td>{ageInDays(row.createdAt)}d</td>
                    <td>{isBreached(row) ? <span className="badge bg-rose-50 text-rose-700 ring-rose-200">Breach</span> : <span className="text-xs text-muted">Within</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 md:hidden">
            {result.rows.map((row) => (
              <Link key={row.id} href={`/complaints/${row.id}`} className="card block p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold text-navy">{row.ticketNumber}</span>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-1 text-sm">{row.customer.name} · {row.customer.phone}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                  <TypeBadge type={row.type} />
                  <span>{row.district?.name ?? "No district"}</span>
                  <span>{ageInDays(row.createdAt)} days</span>
                  <span>{labelOf(COMPLAINT_SOURCES, row.source)}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted">Page {result.page} of {pages}</span>
            <div className="flex gap-2">
              {result.page > 1 ? <Link className="btn btn-ghost" href={`/complaints${qs({ ...preserved, page: result.page - 1 })}`}>Previous</Link> : null}
              {result.page < pages ? <Link className="btn btn-ghost" href={`/complaints${qs({ ...preserved, page: result.page + 1 })}`}>Next</Link> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Select({ label, name, value, options }: { label: string; name: string; value?: string; options: { value: string; label: string }[] }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" name={name} defaultValue={value ?? ""}>
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}
