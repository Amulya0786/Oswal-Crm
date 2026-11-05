import Link from "next/link";
import { prisma } from "@/server/db";
import { getScope } from "@/server/auth";

export const metadata = { title: "Due services" };

export default async function DueServicesPage() {
  const { user } = await getScope();
  if (!user) return null;
  const soon = new Date(Date.now() + 7 * 86400000);
  const contracts = await prisma.serviceContract.findMany({ where: { status: "ACTIVE" }, select: { customerId: true } });
  const customers = contracts.map((row) => row.customerId).filter((id): id is string => Boolean(id));
  const rows = customers.length
    ? await prisma.complaint.findMany({
        where: { customerId: { in: customers }, status: { in: ["OPEN", "ASSIGNED", "REASSIGNED", "PENDING"] }, scheduleDate: { lte: soon } },
        orderBy: { scheduleDate: "asc" },
        take: 100,
        select: { id: true, ticketNo: true, customerName: true, scheduleDate: true, status: true },
      })
    : [];
  return (
    <div>
      <div className="page-head"><h1>Due services</h1></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Complaint</th><th>Customer</th><th>Visit</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/complaints/${row.id}`}>{row.ticketNo}</Link></td>
                <td>{row.customerName}</td>
                <td>{row.scheduleDate ? row.scheduleDate.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "Unscheduled"}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No contract visits are due.</p>}
    </div>
  );
}
