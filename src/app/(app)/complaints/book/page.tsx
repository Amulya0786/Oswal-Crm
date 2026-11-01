import { notFound } from "next/navigation";
import { BookForm } from "./book-form";
import { PageHeader, Forbidden } from "@/components/ui";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";

export const metadata = { title: "Book complaint" };

export default async function BookPage() {
  const user = await requireUser();
  if (!can(user.role, "book")) return <Forbidden title="Your role cannot book complaints." />;
  const stateWhere = user.role === "ADMIN" ? {} : { id: { in: user.stateIds.length ? user.stateIds : ["__none__"] } };
  const [states, districts, areas, products, issues, centers, brands] = await Promise.all([
    prisma.state.findMany({ where: stateWhere, orderBy: { name: "asc" } }),
    prisma.district.findMany({ orderBy: { name: "asc" } }),
    prisma.area.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.complaintIssue.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.serviceCenter.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (states.length === 0 && user.role !== "ADMIN") notFound();
  return (
    <div>
      <PageHeader title="Book complaint" subtitle="Look the customer up by mobile or pump serial. The desk assigns a service centre from the pincode, and you can override it." />
      <BookForm
        states={states.map((state) => ({ id: state.id, name: state.name }))}
        districts={districts.map((district) => ({ id: district.id, name: district.name, stateId: district.stateId }))}
        areas={areas.map((area) => ({ id: area.id, name: area.name, districtId: area.districtId }))}
        products={products.map((product) => ({ id: product.id, name: product.name, brandId: product.brandId }))}
        issues={issues.map((issue) => ({ id: issue.id, name: issue.name, complaintType: issue.complaintType }))}
        centers={centers.map((center) => ({ id: center.id, name: center.name, engineerName: center.engineerName, districtId: center.districtId }))}
        brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
      />
    </div>
  );
}
