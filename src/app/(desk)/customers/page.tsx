import Link from "next/link";
import { Prisma } from "@prisma/client";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { cookies } from "next/headers";
import { EmptyState } from "@/components/chrome";
import { phrase } from "@/lib/desk-copy";
import { NameReviewChip } from "@/components/name-review";
import { nameReviewSql } from "@/lib/names";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, scope } = await getScope();
  if (!user) return null;
  const sp = await searchParams;
  const nameReview = sp.nameReview === "1";
  const lang = (await cookies()).get("oswal_lang")?.value === "hi" ? "hi" : "en";
  const brandLimit = user.role === "OEM_PARTNER"
    ? { complaints: { some: { brandId: { in: user.brandIds.length ? user.brandIds : ["none"] } } } }
    : {};
  const ownCalls = user.role === "TECHNICIAN"
    ? { complaints: { some: { engineerId: user.engineerId || "none" } } }
    : {};
  const where = scope === "all"
    ? user.role === "ADMIN"
      ? { mergedIntoId: null, ...brandLimit, ...ownCalls }
      : { mergedIntoId: null, OR: [{ companyId: { in: user.companyIds } }, { complaints: { some: { companyId: { in: user.companyIds } } } }], ...brandLimit, ...ownCalls }
    : { mergedIntoId: null, OR: [{ companyId: scope }, { complaints: { some: { companyId: scope } } }], ...brandLimit, ...ownCalls };
  const reviewIds = nameReview
    ? (await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Customer"
        WHERE "mergedIntoId" IS NULL AND ${nameReviewSql(Prisma.raw(`"name"`))}
        ORDER BY name ASC
        LIMIT 50
      `).map((row) => row.id)
    : null;
  const customers = await prisma.customer.findMany({
    where: reviewIds ? { AND: [where, { id: { in: reviewIds.length ? reviewIds : ["none"] } }] } : where,
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
      <div className="chips">
        <Link className={nameReview ? "chip on" : "chip"} href={nameReview ? "/customers" : "/customers?nameReview=1"}>Name needs review</Link>
      </div>
      {!customers.length && <EmptyState title={nameReview ? "No names need review" : "No customers yet"} body="" />}
      {!!customers.length && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Mobile</th><th>District</th><th className="num">Complaints</th><th className="num">Assets</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td data-label="Customer"><span className="name-line"><NameReviewChip name={customer.name} /><Link href={`/customers/${customer.id}`}>{customer.name}</Link></span></td>
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
