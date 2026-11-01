import { Shell } from "@/components/shell";
import { requireUser } from "@/server/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <Shell user={{ name: user.name, role: user.role, employeeCode: user.employeeCode }}>
      {children}
    </Shell>
  );
}
