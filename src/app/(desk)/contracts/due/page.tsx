import { prisma } from "@/server/db";
import { getScope } from "@/server/auth";

export const metadata = { title: "Due contracts" };

export default async function DueContractsPage() {
  const { user } = await getScope();
  if (!user) return null;
  const today = new Date();
  const soon = new Date(Date.now() + 30 * 86400000);
  const rows = await prisma.serviceContract.findMany({ where: { status: "ACTIVE", end: { gte: today, lte: soon } }, orderBy: { end: "asc" }, take: 100 });
  return (
    <div>
      <div className="page-head"><h1>Due contracts</h1></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Product</th><th>Ends</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}><td>{row.productName ?? "Contract"}</td><td>{row.end.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td></tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <p>No contracts end in the next 30 days.</p>}
    </div>
  );
}
