import Link from "next/link";
import { notFound } from "next/navigation";
import { getScope } from "@/server/auth";
import { getComplaint } from "@/server/complaints";
import { prisma } from "@/server/db";
import { DetailActions } from "@/components/detail-actions";
import { labelOf, CALL_TYPES, STATUSES, PRIORITIES, statusClass } from "@/lib/labels";
import { ageDays, formatDay, formatWhen } from "@/lib/time";
import { coverStatus } from "@/lib/history";
import { VoiceBox } from "@/components/voice-box";

export const metadata = { title: "Complaint" };

export default async function ComplaintDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const { id } = await params;
  const sp = await searchParams;
  const complaint = await getComplaint(user, scope, id);
  if (!complaint) notFound();
  const [engineers, problems, solutions, checks] = await Promise.all([
    prisma.engineer.findMany({ where: { companyId: complaint.companyId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.actualProblem.findMany({ orderBy: { name: "asc" } }),
    prisma.actualSolution.findMany({ orderBy: { name: "asc" } }),
    prisma.checkItem.findMany({ orderBy: { sort: "asc" } }),
  ]);
  const age = ageDays(complaint.bookDate, complaint.closedAt ?? new Date());
  return (
    <div>
      {sp.new && <div className="banner">Booked. Comp. No is {complaint.ticketNo}.</div>}
      <div className="page-head">
        <div>
          <p className="kicker">{complaint.company.legalName}</p>
          <h1 className="mono">{complaint.ticketNo}</h1>
          <p>
            <span className={statusClass(complaint.status)}>{labelOf(STATUSES, complaint.status)}</span>
            {" "}{labelOf(CALL_TYPES, complaint.callType)} · {labelOf(PRIORITIES, complaint.priority)} · {age} days
            {complaint.slaBreached && " · SLA breached"}
            {complaint.slaRisk && ` · At risk: ${complaint.slaRiskReason ?? ""}`}
            {complaint.repeatOfTicket && ` · repeat of ${complaint.repeatOfTicket}`}
            {complaint.repeatWindow ? ` · repeat failure within ${complaint.repeatWindow} days` : ""}
          </p>
        </div>
        <Link className="btn line" href="/complaints">Back to list</Link>
      </div>
      <div className="docket">
        <section className="panel">
          <h2>Customer</h2>
          <p><b>{complaint.customerId ? <Link href={`/customers/${complaint.customerId}`}>{complaint.customerName}</Link> : complaint.customerName}</b><br />{complaint.phone}<br />{complaint.address}</p>
          <p>{complaint.areaName} · {complaint.districtName} · {complaint.stateName} · {complaint.pincode}</p>
          <h2>Complaint</h2>
          <p>{complaint.natureText}<br />{complaint.assetId ? <Link href={`/assets/${complaint.assetId}`}>{complaint.productDetails}</Link> : complaint.productDetails}<br />Serial {complaint.serialNo ?? (complaint.serialPending ? `Pending (${complaint.serialUnavailableReason ?? "not captured"})` : "—")} · Brand {complaint.brandName ?? "—"}</p>
          {complaint.asset && <p className="muted">{coverStatus(complaint.asset).warranty} · {coverStatus(complaint.asset).amc}</p>}
          {complaint.missingSerialReason && <p>Closed without a serial: {complaint.missingSerialReason}</p>}
          <p>Saral {complaint.saralId ?? "—"} · Scheme {complaint.schemeName ?? "—"} · Consumer {complaint.msedclConsumerNo ?? "—"}</p>
          <p>Booked {formatWhen(complaint.bookDate)} by {complaint.callBy}. Schedule {formatWhen(complaint.scheduleDate)}.</p>
          <p>Source {complaint.source}. Final status {complaint.finalStatus ?? "—"}.</p>
        </section>
        <section className="panel stack">
          <h2>Assignment</h2>
          <p>{complaint.assignedName ?? "Unassigned"}</p>
          {complaint.assignReason && <p className="muted">{complaint.assignReason}</p>}
          {complaint.escalatedTo && <p>Escalated to {complaint.escalatedTo.name} ({complaint.escalatedTo.role})</p>}
          {complaint.actualProblem && <p>Problem: {complaint.actualProblem}<br />Solution: {complaint.actualSolution}</p>}
          {complaint.happyRating && <p>Happy calling {complaint.happyRating}/5. {complaint.happyRemarks}</p>}
          <DetailActions complaint={{ id: complaint.id, status: complaint.status }} engineers={engineers} problems={problems} solutions={solutions} checks={checks} can={user.caps} />
        </section>
      </div>
      <VoiceBox complaintId={complaint.id} />
      <section className="panel" style={{ marginTop: 12 }}>
        <h2>This ticket</h2>
        <ul className="timeline">
          {complaint.timeline.map((item, index) => (
            <li key={`${item.at}-${index}`}><b>{item.type}</b> · {formatWhen(item.at)}<div>{item.message}</div>{item.actorName && <div className="muted">{item.actorName}</div>}</li>
          ))}
        </ul>
        {complaint.attachments.length > 0 && (
          <div>{complaint.attachments.map((file) => <a key={file.id} href={`/api/desk/attachments/${file.id}`}>{file.fileName}</a>)}</div>
        )}
      </section>
      <section className="panel" style={{ marginTop: 12 }}>
        <div className="section-head">
          <h2>Customer and asset history</h2>
          <span className="row-actions">
            {complaint.customerId && <Link className="btn line" href={`/customers/${complaint.customerId}`}>Customer 360</Link>}
            {complaint.assetId && <Link className="btn line" href={`/assets/${complaint.assetId}`}>Asset history</Link>}
          </span>
        </div>
        <ul className="timeline">
          {complaint.relatedTickets.map((item) => (
            <li key={item.id}>
              <b><Link className="mono" href={`/complaints/${item.ticketNo}`}>{item.ticketNo}</Link></b>
              {" "}· {formatDay(item.bookDate)} · <span className={statusClass(item.status)}>{labelOf(STATUSES, item.status)}</span>
              {item.sameAsset ? " · this product" : " · other product"}
              <div>{item.assignedName ?? "Unassigned"} · {item.actualProblem || item.natureText || "Problem not recorded"}</div>
              {item.actualSolution && <div className="muted">Resolution: {item.actualSolution}</div>}
              {!!item.spares.length && <div className="muted">Spares: {item.spares.join(", ")}</div>}
              {item.events.slice(-3).map((event) => <div key={event.at + event.type} className="muted">{formatWhen(event.at)} · {event.message}</div>)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
