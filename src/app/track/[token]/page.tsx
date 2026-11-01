import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { labelOf, STATUSES, CALL_TYPES } from "@/lib/labels";
import { formatWhen } from "@/lib/time";
import { BrandLogo } from "@/components/chrome";
import { TrackRating } from "@/components/track-rating";

export const metadata = { title: "Track" };

export default async function TrackTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const complaint = await prisma.complaint.findFirst({
    where: { OR: [{ trackToken: token }, { ticketNo: token.toUpperCase() }] },
    include: { company: true, events: { orderBy: { at: "asc" }, take: 40 } },
  });
  if (!complaint) notFound();
  const events = complaint.events.filter((event) => ["CREATED", "ASSIGNED", "REASSIGNED", "CLOSED", "HAPPY", "VISIT", "CANCELLED"].includes(event.type));
  return (
    <main className="main" style={{ maxWidth: 640 }}>
      <BrandLogo />
      <section className="panel" style={{ borderTop: `4px solid ${complaint.company.accent}` }}>
        <p className="kicker">{complaint.company.legalName}</p>
        <h1 className="mono">{complaint.ticketNo}</h1>
        <p>{labelOf(STATUSES, complaint.status)} · {labelOf(CALL_TYPES, complaint.callType)}</p>
        <p>Technician: {complaint.assignedName?.split(" ")[0] ?? "Not assigned yet"}</p>
        <p>Expected visit: {complaint.scheduleDate ? formatWhen(complaint.scheduleDate) : "Not scheduled yet"}</p>
        <ul className="timeline">
          {events.map((event) => <li key={event.id}>{formatWhen(event.at)} · {event.message}</li>)}
          {!events.length && <li>Booked {formatWhen(complaint.bookDate)}</li>}
        </ul>
        <TrackRating token={complaint.trackToken ?? complaint.ticketNo} pending={complaint.feedbackPending} rating={complaint.happyRating} />
      </section>
    </main>
  );
}
