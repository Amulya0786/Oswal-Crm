import Link from "next/link";
import { notFound } from "next/navigation";
import { ComplaintActions } from "./actions";
import { PageHeader, StatusBadge, TypeBadge } from "@/components/ui";
import { COMPLAINT_SOURCES, ROLES, labelOf } from "@/lib/constants";
import { formatDateTime } from "@/lib/time";
import { isBreached, isCloseBreach, isResponseBreach } from "@/lib/sla";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";
import { getComplaint } from "@/server/complaints";

const LEVELS = ["Not escalated", "Area manager", "State head", "Admin"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: id };
}

export default async function ComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const complaint = await getComplaint(id, user);
  if (!complaint) notFound();
  const [centers, problems, solutions, holds, checklist] = await Promise.all([
    prisma.serviceCenter.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, engineerName: true } }),
    prisma.actualProblem.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.actualSolution.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, problemId: true } }),
    prisma.holdStatus.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.checkListItem.findMany({
      where: { active: true, OR: [{ complaintType: null }, { complaintType: complaint.type }] },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const checked = new Set<string>(parseChecklist(complaint.checklistJson));
  const mapQuery = [complaint.address, complaint.district?.name, complaint.state?.name, complaint.pincode].filter(Boolean).join(" ");

  return (
    <div>
      <PageHeader
        title={complaint.ticketNumber}
        subtitle={`${complaint.customer.name} · ${complaint.customer.phone}`}
        actions={<Link href="/complaints" className="btn btn-ghost">All complaints</Link>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={complaint.status} />
              <TypeBadge type={complaint.type} />
              <span className="badge bg-slate-50 text-slate-700 ring-slate-200">{labelOf(COMPLAINT_SOURCES, complaint.source)}</span>
              {complaint.priority !== "NORMAL" ? <span className="badge bg-rose-50 text-rose-800 ring-rose-200">{complaint.priority}</span> : null}
              {isResponseBreach(complaint) ? <span className="badge bg-rose-50 text-rose-700 ring-rose-200">Response breach</span> : null}
              {isCloseBreach(complaint) ? <span className="badge bg-rose-50 text-rose-700 ring-rose-200">Closing breach</span> : null}
              {!isBreached(complaint) && (complaint.status === "OPEN" || complaint.status === "ASSIGNED" || complaint.status === "REASSIGNED" || complaint.status === "PENDING") ? <span className="badge bg-emerald-50 text-emerald-800 ring-emerald-200">Within SLA</span> : null}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Item label="Logged" value={formatDateTime(complaint.createdAt)} />
              <Item label="By" value={complaint.createdBy ? `${complaint.createdBy.name} (${labelOf(ROLES, complaint.createdBy.role)})` : "Import"} />
              <Item label="State" value={complaint.state?.name} />
              <Item label="District" value={complaint.district?.name} />
              <Item label="Area" value={complaint.area?.name} />
              <Item label="Pincode" value={complaint.pincode} />
              <Item label="Product" value={complaint.product ? `${complaint.product.name}${complaint.product.hpCapacity ? ` · ${complaint.product.hpCapacity.name}` : ""}` : null} />
              <Item label="Serial" value={complaint.serialNumber} />
              <Item label="Brand" value={complaint.brand?.name} />
              <Item label="Issue" value={complaint.issue?.name} />
              <Item label="Scheme" value={complaint.scheme ? `${complaint.scheme}${complaint.consumerNumber ? ` · ${complaint.consumerNumber}` : ""}` : null} />
              <Item label="Service centre" value={complaint.serviceCenter ? `${complaint.serviceCenter.name} · ${complaint.serviceCenter.engineerName}` : "Unassigned"} />
              <Item label="Technician login" value={complaint.assignedTo?.name} />
              <Item label="Escalation" value={LEVELS[complaint.escalationLevel] ?? "Admin"} />
              <Item label="Response due" value={formatDateTime(complaint.slaResponseDue)} />
              <Item label="Close due" value={formatDateTime(complaint.slaCloseDue)} />
            </dl>
            {complaint.description ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">{complaint.description}</p> : null}
            {complaint.address ? (
              <p className="mt-3 text-sm text-muted">
                {complaint.address}{" "}
                <a className="text-navy underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}>Map</a>
              </p>
            ) : null}
            {complaint.holdReason ? <p className="mt-3 text-sm text-amber-900">On hold ({complaint.holdStatus?.name}): {complaint.holdReason}</p> : null}
            {complaint.closeNotes || complaint.actualProblem ? (
              <p className="mt-3 text-sm">Closed with {complaint.actualProblem?.name ?? "no problem recorded"} → {complaint.actualSolution?.name ?? "no solution recorded"}. {complaint.closeNotes}</p>
            ) : null}
            {complaint.happyRating ? <p className="mt-2 text-sm">Happy calling {complaint.happyRating}/5. {complaint.happyNotes}</p> : null}
            {complaint.cancelReason ? <p className="mt-2 text-sm text-rose-800">Cancelled: {complaint.cancelReason}</p> : null}
            {checked.size > 0 ? (
              <ul className="mt-3 list-disc pl-5 text-sm text-muted">
                {[...checked].map((item) => <li key={item}>{checklist.find((row) => row.id === item)?.name ?? item}</li>)}
              </ul>
            ) : null}
          </section>
          <section className="card p-4">
            <h2 className="font-display text-lg font-semibold text-navy">Timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-4">
              {complaint.events.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted">{event.type.replaceAll("_", " ")} · {formatDateTime(event.createdAt)}</div>
                  <div className="text-sm">{event.message}</div>
                  {event.user ? <div className="text-xs text-muted">{event.user.name} · {labelOf(ROLES, event.user.role)}</div> : null}
                </li>
              ))}
            </ol>
          </section>
          {complaint.attachments.length > 0 ? (
            <section className="card p-4">
              <h2 className="font-display text-lg font-semibold text-navy">Attachments</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {complaint.attachments.map((file) => (
                  <li key={file.id}>
                    <a className="text-navy underline" href={`/api/attachments/${file.id}`}>{file.fileName}</a>
                    <span className="text-muted"> · {Math.ceil(file.size / 1024)} KB · {formatDateTime(file.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        <aside className="space-y-4">
          <section className="card p-4 lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-semibold text-navy">Update</h2>
            <div className="mt-3">
              <ComplaintActions complaintId={complaint.id} status={complaint.status} role={user.role} centers={centers} problems={problems} solutions={solutions} holds={holds} checklist={checklist} />
            </div>
          </section>
          {complaint.escalations.length > 0 ? (
            <section className="card p-4">
              <h2 className="font-display text-base font-semibold text-navy">Escalation log</h2>
              <ul className="mt-2 space-y-2 text-sm">
                {complaint.escalations.map((row) => (
                  <li key={row.id}>
                    <div className="font-medium">Level {row.fromLevel} → {row.toLevel} · {labelOf(ROLES, row.toRole)}</div>
                    <div className="text-muted">{row.reason}. {row.toUser?.name ?? "No user in role."} {formatDateTime(row.createdAt)}</div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function parseChecklist(value: string | null) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function Item({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}
