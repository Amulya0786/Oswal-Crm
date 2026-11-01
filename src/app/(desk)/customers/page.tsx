import Link from "next/link";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { cookies } from "next/headers";
import { EmptyState } from "@/components/chrome";
import { phrase } from "@/lib/desk-copy";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const { user, scope } = await getScope();
  if (!user) return null;
  const lang = (await cookies()).get("oswal_lang")?.value === "hi" ? "hi" : "en";
  const brandLimit = user.role === "OEM_PARTNER"
    ? { complaints: { some: { brandId: { in: user.brandIds.length ? user.brandIds : ["none"] } } } }
    : {};
  const where = scope === "all"
    ? user.role === "ADMIN"
      ? { mergedIntoId: null, ...brandLimit }
      : { mergedIntoId: null, OR: [{ companyId: { in: user.companyIds } }, { complaints: { some: { companyId: { in: user.companyIds } } } }], ...brandLimit }
    : { mergedIntoId: null, OR: [{ companyId: scope }, { complaints: { some: { companyId: scope } } }], ...brandLimit };
  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: "asc" },
    take: 50,
    include: { _count: { select: { complaints: true, assets: true } }, district: { select: { name: true } } },
  });
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{phrase(lang, "Customers")}</h1>
        </div>
      </div>
      {!customers.length && <EmptyState title="No customers yet" body="" />}
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
