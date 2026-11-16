import Link from "next/link";
import { prisma } from "@/server/db";
import { getScope } from "@/server/auth";

export const metadata = { title: "AMC renewals" };

export default async function ContractsPage() {
  const { user } = await getScope();
  if (!user) return null;
  const soon = new Date(Date.now() + 60 * 86400000);
  const rows = await prisma.serviceContract.findMany({ where: { end: { lte: soon } }, orderBy: { end: "asc" }, take: 100 });
  return (
    <div>
      <div className="page-head">
        <h1>AMC renewals</h1>
        <div className="filters">
          <Link className="btn line" href="/contracts/due">Due contracts</Link>
          <Link className="btn line" href="/contracts/services">Due services</Link>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Ends</th><th>Status</th><th>Visits</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.productName ?? "Contract"}</td>
                <td>{row.end.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td>{row.status}</td>
                <td>{row.visitsIncluded ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No renewals in the next 60 days.</p>}
    </div>
  );
}
