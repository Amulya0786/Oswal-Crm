import * as xlsx from "xlsx";
import { COMPLAINT_STATUSES, COMPLAINT_TYPES, ROLES, labelOf } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isBreached } from "@/lib/sla";
import { ageInDays, formatDate } from "@/lib/time";
import { isOpenWork } from "@/lib/workflow";
import type { CurrentUser } from "./current-user";
import { filtersToWhere, type ComplaintFilters } from "./complaints";
import { andWhere, complaintWhere } from "./scope";

export const REPORTS = [
  { slug: "employee-work", title: "Employee Work Summary", blurb: "Notes, visits, assignments, closures and happy calls by employee." },
  { slug: "complaint-summary", title: "Complaint Summary", blurb: "Counts by status and complaint type, with age and SLA breaches." },
  { slug: "msedcl", title: "MSEDCL Complaint Details", blurb: "Scheme complaints logged for MSEDCL. Switch the scheme filter for KUSUM." },
  { slug: "technician-wise", title: "Technician-wise Call Details", blurb: "Open, pending and closed calls for each engineer." },
  { slug: "category-wise", title: "Category-wise Call Details", blurb: "Calls grouped by product category." },
  { slug: "nature-wise", title: "Nature-wise Call Details", blurb: "Calls grouped by the complaint issue." },
  { slug: "problem-wise", title: "Problem-wise Call Details", blurb: "Actual problems recorded at closing." },
  { slug: "product-wise", title: "Product-wise Call Details", blurb: "Calls grouped by pump or motor." },
  { slug: "state-tickets", title: "State Ticket Count", blurb: "The state ticket counter: open work and outcomes by state." },
  { slug: "brand-tickets", title: "Brand Ticket Count", blurb: "The brand ticket counter: open work and outcomes by OEM / brand." },
] as const;

export type ReportSlug = (typeof REPORTS)[number]["slug"];

export type ReportColumn = { key: string; label: string };
export type ReportResult = { slug: string; title: string; columns: ReportColumn[]; rows: Record<string, string | number>[] };

function safeCell(value: string | number | undefined | null) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export function workbookBuffer(title: string, columns: ReportColumn[], rows: Record<string, string | number>[]) {
  const matrix = [columns.map((column) => column.label), ...rows.map((row) => columns.map((column) => safeCell(row[column.key])))];
  const sheet = xlsx.utils.aoa_to_sheet(matrix);
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(book, sheet, title.slice(0, 31).replace(/[\\/?*[\]]/g, " ") || "Report");
  return xlsx.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function breach(row: { status: string; firstResponseAt: Date | null; slaResponseDue: Date | null; slaCloseDue: Date | null; escalationLevel: number; lastEscalatedAt: Date | null }) {
  return isBreached(row) ? 1 : 0;
}

type Loaded = Awaited<ReturnType<typeof loadComplaints>>;

async function loadComplaints(user: CurrentUser, filters: ComplaintFilters) {
  return prisma.complaint.findMany({
    where: andWhere([complaintWhere(user), filtersToWhere(filters)]),
    include: {
      state: { select: { name: true } },
      district: { select: { name: true } },
      brand: { select: { name: true } },
      product: { select: { name: true, family: true, category: { select: { name: true } } } },
      issue: { select: { name: true } },
      actualProblem: { select: { name: true } },
      assignedTo: { select: { name: true } },
      serviceCenter: { select: { name: true, engineerName: true } },
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

function outcomeRow(name: string, rows: Loaded) {
  const count = (status: string | string[]) => rows.filter((row) => (Array.isArray(status) ? status.includes(row.status) : row.status === status)).length;
  return {
    name,
    open: count("OPEN"),
    assigned: count(["ASSIGNED", "REASSIGNED"]),
    pending: count("PENDING"),
    closed: count("CLOSED"),
    happy: count("HAPPY_CALLING_DONE"),
    cancelled: count("CANCELLED"),
    openWork: rows.filter((row) => isOpenWork(row.status)).length,
    breaches: rows.reduce((sum, row) => sum + breach(row), 0),
  };
}

const OUTCOME_COLUMNS: ReportColumn[] = [
  { key: "name", label: "Name" },
  { key: "open", label: "Open" },
  { key: "assigned", label: "Assigned" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed" },
  { key: "happy", label: "Happy calling" },
  { key: "cancelled", label: "Cancelled" },
  { key: "openWork", label: "Open work" },
  { key: "breaches", label: "SLA breaches" },
];

function withTotal(rows: Record<string, string | number>[], labelKey = "name") {
  if (rows.length === 0) return rows;
  const total: Record<string, string | number> = { [labelKey]: "Total" };
  for (const key of Object.keys(rows[0])) {
    if (key === labelKey) continue;
    const numeric = rows.every((row) => typeof row[key] === "number");
    total[key] = numeric ? rows.reduce((sum, row) => sum + Number(row[key]), 0) : "";
  }
  return [...rows, total];
}

export async function runReport(slug: string, user: CurrentUser, filters: ComplaintFilters): Promise<ReportResult> {
  const report = REPORTS.find((item) => item.slug === slug);
  if (!report) throw new AppError("Unknown report.", 404);
  const now = new Date();

  if (slug === "employee-work") {
    const events = await prisma.complaintEvent.findMany({
      where: {
        userId: { not: null },
        complaint: andWhere([complaintWhere(user), filtersToWhere({ ...filters, from: undefined, to: undefined })]),
        ...(filters.from || filters.to
          ? { createdAt: { ...(filters.from ? { gte: new Date(filters.from) } : {}), ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59`) } : {}) } }
          : {}),
      },
      include: { user: true },
    });
    const grouped = new Map<string, { name: string; role: string; complaints: Set<string>; notes: number; visits: number; closures: number; happy: number; assignments: number }>();
    for (const event of events) {
      if (!event.user) continue;
      const current = grouped.get(event.user.id) ?? {
        name: event.user.name,
        role: labelOf(ROLES, event.user.role),
        complaints: new Set<string>(),
        notes: 0,
        visits: 0,
        closures: 0,
        happy: 0,
        assignments: 0,
      };
      current.complaints.add(event.complaintId);
      if (event.type === "NOTE") current.notes++;
      if (event.type === "VISIT") current.visits++;
      if (event.type === "CLOSED") current.closures++;
      if (event.type === "HAPPY_CALL" || event.type === "FEEDBACK") current.happy++;
      if (event.type === "ASSIGNED" || event.type === "REASSIGNED") current.assignments++;
      grouped.set(event.user.id, current);
    }
    const rows = [...grouped.values()]
      .map((row) => ({
        employee: row.name,
        role: row.role,
        touched: row.complaints.size,
        notes: row.notes,
        visits: row.visits,
        closures: row.closures,
        happy: row.happy,
        assignments: row.assignments,
      }))
      .sort((a, b) => b.touched - a.touched);
    return {
      slug,
      title: report.title,
      columns: [
        { key: "employee", label: "Employee" },
        { key: "role", label: "Role" },
        { key: "touched", label: "Complaints touched" },
        { key: "notes", label: "Notes" },
        { key: "visits", label: "Visits" },
        { key: "closures", label: "Closures" },
        { key: "happy", label: "Happy calls" },
        { key: "assignments", label: "Assignments" },
      ],
      rows,
    };
  }

  const scopedFilters = slug === "msedcl" ? { ...filters, scheme: filters.scheme || "MSEDCL" } : filters;
  const complaints = await loadComplaints(user, scopedFilters);

  if (slug === "msedcl") {
    return {
      slug,
      title: report.title,
      columns: [
        { key: "ticket", label: "Ticket" },
        { key: "logged", label: "Logged" },
        { key: "consumer", label: "Consumer no." },
        { key: "customer", label: "Customer" },
        { key: "phone", label: "Mobile" },
        { key: "district", label: "District" },
        { key: "state", label: "State" },
        { key: "product", label: "Product" },
        { key: "status", label: "Status" },
        { key: "scheme", label: "Scheme" },
        { key: "narration", label: "Narration" },
      ],
      rows: complaints.map((row) => ({
        ticket: row.ticketNumber,
        logged: formatDate(row.createdAt),
        consumer: row.consumerNumber ?? "",
        customer: row.customer.name,
        phone: row.customer.phone,
        district: row.district?.name ?? "",
        state: row.state?.name ?? "",
        product: row.product?.name ?? "",
        status: labelOf(COMPLAINT_STATUSES, row.status),
        scheme: row.scheme ?? "",
        narration: row.description ?? "",
      })),
    };
  }

  if (slug === "complaint-summary") {
    const columns: ReportColumn[] = [
      { key: "section", label: "Section" },
      { key: "name", label: "Name" },
      { key: "count", label: "Count" },
      { key: "openWork", label: "Open work" },
      { key: "breaches", label: "SLA breaches" },
      { key: "avgAge", label: "Average age (days)" },
    ];
    const average = (rows: Loaded) => (rows.length ? Math.round(rows.reduce((sum, row) => sum + ageInDays(row.createdAt, now), 0) / rows.length) : 0);
    const statusRows = COMPLAINT_STATUSES.map((status) => {
      const matching = complaints.filter((row) => row.status === status.value);
      return { section: "Status", name: status.label, count: matching.length, openWork: matching.filter((row) => isOpenWork(row.status)).length, breaches: matching.reduce((sum, row) => sum + breach(row), 0), avgAge: average(matching) };
    });
    const typeRows = COMPLAINT_TYPES.map((type) => {
      const matching = complaints.filter((row) => row.type === type.value);
      return { section: "Type", name: type.label, count: matching.length, openWork: matching.filter((row) => isOpenWork(row.status)).length, breaches: matching.reduce((sum, row) => sum + breach(row), 0), avgAge: average(matching) };
    });
    return { slug, title: report.title, columns, rows: [...statusRows, ...typeRows] };
  }

  if (slug === "technician-wise" || slug === "state-tickets" || slug === "brand-tickets" || slug === "category-wise" || slug === "nature-wise" || slug === "problem-wise" || slug === "product-wise") {
    const keyOf = (row: Loaded[number]) => {
      if (slug === "technician-wise") return row.assignedTo?.name ?? row.serviceCenter?.engineerName ?? "Unassigned";
      if (slug === "state-tickets") return row.state?.name ?? "No state";
      if (slug === "brand-tickets") return row.brand?.name ?? "No brand";
      if (slug === "category-wise") return row.product?.category?.name ?? "Uncategorised";
      if (slug === "nature-wise") return row.issue?.name ?? "Not specified";
      if (slug === "problem-wise") return row.actualProblem?.name ?? "Not recorded";
      return row.product?.name ?? "No product";
    };
    const groups = new Map<string, Loaded>();
    for (const row of complaints) {
      const key = keyOf(row);
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    if (slug === "category-wise" || slug === "nature-wise" || slug === "product-wise") {
      const rows = [...groups.entries()]
        .map(([name, grouped]) => ({
          name,
          family: slug === "product-wise" ? grouped[0]?.product?.family ?? "" : "",
          logged: grouped.length,
          open: grouped.filter((row) => isOpenWork(row.status)).length,
          closed: grouped.filter((row) => row.status === "CLOSED" || row.status === "HAPPY_CALLING_DONE").length,
        }))
        .sort((a, b) => b.logged - a.logged);
      const columns: ReportColumn[] = [
        { key: "name", label: slug === "product-wise" ? "Product" : slug === "category-wise" ? "Category" : "Issue" },
        ...(slug === "product-wise" ? [{ key: "family", label: "Family" }] : []),
        { key: "logged", label: "Logged" },
        { key: "open", label: "Open work" },
        { key: "closed", label: "Closed" },
      ];
      return { slug, title: report.title, columns, rows: withTotal(rows) };
    }
    if (slug === "problem-wise") {
      const rows = [...groups.entries()]
        .map(([name, grouped]) => ({ name, count: grouped.length }))
        .sort((a, b) => b.count - a.count);
      return { slug, title: report.title, columns: [{ key: "name", label: "Actual problem" }, { key: "count", label: "Complaints" }], rows: withTotal(rows) };
    }
    const rows = [...groups.entries()]
      .map(([name, grouped]) => outcomeRow(name, grouped))
      .sort((a, b) => b.openWork - a.openWork || a.name.localeCompare(b.name));
    const columns = OUTCOME_COLUMNS.map((column) => (column.key === "name" ? { ...column, label: slug === "technician-wise" ? "Technician" : slug === "brand-tickets" ? "Brand" : "State" } : column));
    return { slug, title: report.title, columns, rows: withTotal(rows) };
  }

  throw new AppError("Unknown report.", 404);
}
