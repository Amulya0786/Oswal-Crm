import { Forbidden, PageHeader } from "@/components/ui";
import { UserAdmin } from "@/components/user-admin";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/current-user";
import { listUsers } from "@/server/users";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await requireUser();
  if (!can(user.role, "manageUsers")) return <Forbidden title="Only an admin can manage users and permissions." />;
  const [users, states, districts, brands] = await Promise.all([
    listUsers(),
    prisma.state.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, stateId: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <div>
      <PageHeader title="Security" subtitle="Create users and grant state, district and OEM / brand permissions. Dealer is a placeholder until the Phase 3 portal." />
      <UserAdmin
        users={users.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          employeeCode: row.employeeCode,
          active: row.active,
          stateIds: row.stateIds,
          districtIds: row.districtIds,
          brandIds: row.brandIds,
        }))}
        states={states}
        districts={districts}
        brands={brands}
      />
    </div>
  );
}
