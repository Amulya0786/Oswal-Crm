import { redirect } from "next/navigation";
import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { BookForm } from "@/components/book-form";

export const metadata = { title: "Book complaint" };

export default async function BookPage() {
  const { user, scope } = await getScope();
  if (!user) return null;
  if (!user.caps.book) redirect("/complaints");
  const companyIds = user.role === "ADMIN" ? undefined : user.companyIds;
  const companyFilter = companyIds ? { companyId: { in: companyIds } } : {};
  const [companies, categories, states, districts, areas, pincodes, products, engineers, brands, issues] = await Promise.all([
    prisma.company.findMany({ where: user.role === "ADMIN" ? { active: true } : { id: { in: user.companyIds } }, orderBy: { code: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, companyCode: true } }),
    prisma.state.findMany({ orderBy: { name: "asc" } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, stateId: true } }),
    prisma.area.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, districtId: true } }),
    prisma.pincode.findMany({ select: { code: true, districtId: true, areaId: true } }),
    prisma.product.findMany({ where: { active: true, ...companyFilter }, orderBy: { name: "asc" } }),
    prisma.engineer.findMany({ where: { active: true, ...companyFilter }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ where: companyFilter, orderBy: { name: "asc" } }),
    prisma.complaintIssue.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <div className="page-head">
        <div>
          <p className="kicker">New complaint</p>
          <h1>Book a call</h1>
          <p>Comp. No is assigned when you save. Look up the mobile or serial first.</p>
        </div>
      </div>
      <BookForm options={{ companies, categories, states, districts, areas, pincodes, products, engineers, brands, issues }} scope={scope} />
    </div>
  );
}
