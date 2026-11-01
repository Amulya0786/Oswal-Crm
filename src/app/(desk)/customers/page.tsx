import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { EmptyState } from "@/components/chrome";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { user, scope } = await getScope();
  if (!user) return null;
  const where = scope === "all"
    ? user.role === "ADMIN"
      ? { mergedIntoId: null }
      : { mergedIntoId: null, OR: [{ companyId: { in: user.companyIds } }, { complaints: { some: { companyId: { in: user.companyIds } } } }] }
    : { mergedIntoId: null, OR: [{ companyId: scope }, { complaints: { some: { companyId: scope } } }] };
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    take: 200,
    include: { _count: { select: { complaints: true, assets: true } }, district: { select: { name: true } } },
  });
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">Service</p>
          <h1>Customers</h1>
          <p>One record per person. Open a customer to see every complaint and installed product.</p>
        </div>
      </div>
      {!customers.length && <EmptyState title="No customers yet" body="A customer record is created the first time you book a complaint for that mobile." />}
      {!!customers.length && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Mobile</th><th>District</th><th className="num">Complaints</th><th className="num">Assets</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td data-label="Customer"><Link href={`/customers/${customer.id}`}>{customer.name}</Link></td>
                  <td data-label="Mobile" className="mono">{customer.phone}</td>
                  <td data-label="District">{customer.district?.name ?? "—"}</td>
                  <td data-label="Complaints" className="num">{customer._count.complaints}</td>
                  <td data-label="Assets" className="num">{customer._count.assets}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
