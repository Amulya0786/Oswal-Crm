import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { EmptyState } from "@/components/chrome";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const { user, scope } = await getScope();
  if (!user) return null;
  const company = scope === "all" ? {} : { companyId: scope };
  const rows = await prisma.complaint.findMany({
    where: { ...company, feedbackPending: true, excludeFromMis: false },
    orderBy: { closedAt: "desc" },
    take: 50,
    select: { id: true, ticketNo: true, customerName: true, assignedName: true, closedAt: true },
  });
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Feedback</p>
          <h1>Waiting on a rating</h1>
          <p>A 1 to 5 reply on WhatsApp is stored on the ticket. A score of 2 or less is escalated. Call-centre happy calling remains for customers who do not use WhatsApp.</p>
        </div>
      </div>
      {!rows.length && <EmptyState title="No feedback is waiting" body="Closed visits ask for a rating. Until a complaint is closed, this list stays empty." />}
      {!!rows.length && rows.map((row) => <p key={row.id}><Link className="mono" href={`/complaints/${row.ticketNo}`}>{row.ticketNo}</Link> · {row.customerName} · {row.assignedName ?? "Unassigned"}</p>)}
    </div>
  );
}
