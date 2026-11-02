import Link from "next/link";
import { notFound } from "next/navigation";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { coverStatus } from "@/lib/history";
import { labelOf, STATUSES, statusClass } from "@/lib/labels";
import { formatDay } from "@/lib/time";
import { MergeForm } from "@/components/merge-form";
import { NameReviewChip } from "@/components/name-review";

export const metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      phones: true,
      district: true,
      state: true,
      area: true,
      assets: { orderBy: { productName: "asc" }, include: { complaints: { select: { id: true } } } },
      complaints: { orderBy: { bookDate: "desc" }, take: 50, include: { spares: true } },
    },
  });
  if (!customer || customer.mergedIntoId) notFound();
  if (scope !== "all" && customer.companyId !== scope && !customer.complaints.some((row) => row.companyId === scope)) notFound();
  if (user.role === "OEM_PARTNER") {
    customer.complaints = customer.complaints.filter((row) => row.brandId && user.brandIds.includes(row.brandId));
    if (!customer.complaints.length) notFound();
  }
  if (user.role === "TECHNICIAN") {
    if (!user.engineerId) notFound();
    const owns = await prisma.complaint.count({ where: { customerId: customer.id, engineerId: user.engineerId } });
    if (!owns) notFound();
    customer.complaints = customer.complaints.filter((row) => row.engineerId === user.engineerId);
  }
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Customer 360</p>
          <h1>{customer.name} <NameReviewChip name={customer.name} /></h1>
          <p className="mono">{customer.phone}{customer.phones.length ? ` · also ${customer.phones.map((item) => item.phoneNorm).join(", ")}` : ""}</p>
        </div>
        <Link className="btn line" href="/customers">All customers</Link>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Person</h2>
          <p>{customer.address ?? "No address yet"}</p>
          <p>{[customer.area?.name, customer.district?.name, customer.state?.name, customer.pincode].filter(Boolean).join(" · ") || "Location not recorded"}</p>
          <p className="muted">{customer.complaints.length} complaints · {customer.assets.length} installed products</p>
        </section>
        <section className="panel">
          <h2>Installed products</h2>
          {!customer.assets.length && <p className="muted">No asset is linked yet.</p>}
          {customer.assets.map((asset) => {
            const cover = coverStatus(asset);
            return (
              <p key={asset.id}>
                <Link href={`/assets/${asset.id}`}><b>{asset.modelName || asset.productName || "Installed product"}</b></Link>
                <span className="muted"> · {[asset.capacityLabel, asset.serialNorm].filter(Boolean).join(" · ") || "No serial"} · {cover.warranty} · {cover.amc}</span>
              </p>
            );
          })}
        </section>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Complaint history</h2>
        {!customer.complaints.length && <p className="muted">No complaints for this customer.</p>}
        {!!customer.complaints.length && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Comp. No</th><th>Booked</th><th>Status</th><th>Technician</th><th>Problem</th><th>Resolution</th><th>Spares</th></tr>
              </thead>
              <tbody>
                {customer.complaints.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Comp. No"><Link className="mono" href={`/complaints/${row.ticketNo}`}>{row.ticketNo}</Link>{row.repeatOfTicket ? <div className="muted">repeat of {row.repeatOfTicket}</div> : null}</td>
                    <td data-label="Booked">{formatDay(row.bookDate)}</td>
                    <td data-label="Status"><span className={statusClass(row.status)}>{labelOf(STATUSES, row.status)}</span></td>
                    <td data-label="Technician">{row.assignedName ?? "—"}</td>
                    <td data-label="Problem">{row.actualProblem || row.natureText || "—"}</td>
                    <td data-label="Resolution">{row.actualSolution ?? "—"}</td>
                    <td data-label="Spares">{row.spares.map((spare) => spare.partName).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {user.role === "ADMIN" && (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Merge a duplicate</h2>
          <p className="muted">Moves the other person’s complaints and assets onto this record. The merge is written to the audit log.</p>
          <MergeForm keepId={customer.id} />
        </section>
      )}
    </div>
  );
}
