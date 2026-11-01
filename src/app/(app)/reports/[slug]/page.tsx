import Link from "next/link";
import { notFound } from "next/navigation";
import { Forbidden, PageHeader } from "@/components/ui";
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, SCHEMES } from "@/lib/constants";
import { firstParam, qs } from "@/lib/qs";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";
import { REPORTS, runReport } from "@/server/reports";
import { AppError } from "@/lib/errors";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: REPORTS.find((report) => report.slug === slug)?.title ?? "Report" };
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!can(user.role, "viewReports")) return <Forbidden />;
  const { slug } = await params;
  const sp = await searchParams;
  const filters = {
    from: firstParam(sp.from),
    to: firstParam(sp.to),
    stateId: firstParam(sp.stateId),
    districtId: firstParam(sp.districtId),
    status: firstParam(sp.status),
    type: firstParam(sp.type),
    technicianId: firstParam(sp.technicianId),
    brandId: firstParam(sp.brandId),
    scheme: firstParam(sp.scheme),
  };
  const [states, districts, technicians, brands] = await Promise.all([
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "TECHNICIAN", active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  try {
    const report = await runReport(slug, user, filters);
    return (
      <div>
        <PageHeader
          title={report.title}
          subtitle={REPORTS.find((item) => item.slug === slug)?.blurb}
          actions={
            <>
              <Link href="/reports" className="btn btn-ghost">All reports</Link>
              {can(user.role, "exportReports") ? <a className="btn btn-accent" href={`/api/reports/${slug}/export${qs(filters)}`}>Export Excel</a> : null}
            </>
          }
        />
        <form className="card mb-4 grid gap-3 p-4 md:grid-cols-4" method="get">
          <label><span className="label">From</span><input className="field" type="date" name="from" defaultValue={filters.from ?? ""} /></label>
          <label><span className="label">To</span><input className="field" type="date" name="to" defaultValue={filters.to ?? ""} /></label>
          <Select name="stateId" label="State" value={filters.stateId} options={states.map((state) => ({ value: state.id, label: state.name }))} />
          <Select name="districtId" label="District" value={filters.districtId} options={districts.map((district) => ({ value: district.id, label: district.name }))} />
          <Select name="status" label="Status" value={filters.status} options={COMPLAINT_STATUSES.map((status) => ({ value: status.value, label: status.label }))} />
          <Select name="type" label="Type" value={filters.type} options={COMPLAINT_TYPES.map((type) => ({ value: type.value, label: type.label }))} />
          <Select name="technicianId" label="Technician" value={filters.technicianId} options={technicians.map((tech) => ({ value: tech.id, label: tech.name }))} />
          <Select name="brandId" label="Brand" value={filters.brandId} options={brands.map((brand) => ({ value: brand.id, label: brand.name }))} />
          {slug === "msedcl" ? <Select name="scheme" label="Scheme" value={filters.scheme || "MSEDCL"} options={SCHEMES.map((scheme) => ({ value: scheme.value, label: scheme.label }))} /> : null}
          <div className="flex items-end"><button className="btn btn-navy">Apply</button></div>
        </form>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>{report.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              {report.rows.length === 0 ? <tr><td colSpan={report.columns.length} className="text-muted">Nothing in this filter.</td></tr> : null}
              {report.rows.map((row, index) => (
                <tr key={index}>
                  {report.columns.map((column) => <td key={column.key}>{String(row[column.key] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: { value: string; label: string }[] }) {
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
