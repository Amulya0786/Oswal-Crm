import Link from "next/link";
import { notFound } from "next/navigation";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { coverStatus } from "@/lib/history";
import { labelOf, STATUSES, statusClass } from "@/lib/labels";
import { formatDay } from "@/lib/time";
import { AssetCoverForm } from "@/components/asset-cover";

export const metadata = { title: "Asset" };

function dayInput(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const { id } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      customer: true,
      complaints: { orderBy: { bookDate: "asc" }, include: { spares: true, events: { orderBy: { at: "asc" }, take: 20 } } },
    },
  });
  if (!asset) notFound();
  if (scope !== "all" && asset.companyId !== scope) notFound();
  const cover = coverStatus(asset);
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Asset history</p>
          <h1>{asset.modelName || asset.productName || "Installed product"}</h1>
          <p>{[asset.capacityLabel, asset.serialNorm ? `Serial ${asset.serialNorm}` : "No serial"].filter(Boolean).join(" · ")}</p>
        </div>
        <Link className="btn line" href={`/customers/${asset.customerId}`}>Customer 360</Link>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Installation</h2>
          <p><Link href={`/customers/${asset.customerId}`}><b>{asset.customer.name}</b></Link> · <span className="mono">{asset.customer.phone}</span></p>
          <p>{cover.warranty} · {cover.amc}</p>
          <p className="muted">{asset.complaints.length} complaint{asset.complaints.length === 1 ? "" : "s"} on this product.</p>
        </section>
        {(user.role === "ADMIN" || user.caps.masterWrite) && (
          <section className="panel">
            <h2>Warranty and AMC</h2>
            <AssetCoverForm assetId={asset.id} warrantyUntil={dayInput(asset.warrantyUntil)} amcUntil={dayInput(asset.amcUntil)} />
          </section>
        )}
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Timeline</h2>
        {!asset.complaints.length && <p className="muted">No complaints on this asset yet.</p>}
        <ul className="timeline">
          {asset.complaints.map((row) => (
            <li key={row.id}>
              <b><Link className="mono" href={`/complaints/${row.ticketNo}`}>{row.ticketNo}</Link></b>
              {" "}· {formatDay(row.bookDate)} · <span className={statusClass(row.status)}>{labelOf(STATUSES, row.status)}</span>
              {row.repeatOfTicket && <div>repeat of {row.repeatOfTicket}{row.repeatWindow ? ` · within ${row.repeatWindow} days` : ""}</div>}
              <div>{row.assignedName ?? "Unassigned"} · {row.actualProblem || row.natureText || "Problem not recorded"}</div>
              {row.actualSolution && <div className="muted">Resolution: {row.actualSolution}</div>}
              {!!row.spares.length && <div className="muted">Spares: {row.spares.map((spare) => spare.partName).join(", ")}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
