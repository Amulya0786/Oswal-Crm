import { getScope } from "@/server/auth";
import { prisma } from "@/server/db";
import { UserForm } from "@/components/user-form";
import { formatWhen } from "@/lib/time";
import { ROLE_LABEL } from "@/lib/labels";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const { user } = await getScope();
  if (!user?.caps.security) return <p>Security is for admins.</p>;
  const [users, companies, states, districts, brands, logins, audits] = await Promise.all([
    prisma.user.findMany({ include: { memberships: true, states: true, districts: true, brands: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany(),
    prisma.state.findMany({ orderBy: { name: "asc" } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, take: 200 }),
    prisma.brand.findMany(),
    prisma.loginHistory.findMany({ orderBy: { at: "desc" }, take: 20 }),
    prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 20 }),
  ]);
  return (
    <div>
      <div className="page-head"><div><p className="kicker">Security</p><h1>People and permissions</h1><p>District, state and brand access decide what each person can see.</p></div></div>
      <UserForm companies={companies} states={states} districts={districts} brands={brands} />
      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Companies</th><th>Districts</th><th>Brands</th></tr></thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td><td>{row.email}</td><td>{ROLE_LABEL[row.role] ?? row.role}</td>
                <td>{row.memberships.length}</td><td>{row.districts.length || "All"}</td><td>{row.brands.length || "All"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <section className="panel"><h2>Login history</h2>{logins.map((row) => <p key={row.id}>{formatWhen(row.at)} · {row.email} · {row.success ? "ok" : "failed"}</p>)}</section>
        <section className="panel"><h2>Audit</h2>{audits.map((row) => <p key={row.id}>{formatWhen(row.at)} · {row.action} · {row.summary}</p>)}</section>
      </div>
    </div>
  );
}
