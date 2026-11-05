import { redirect } from "next/navigation";
import { getScope } from "@/server/auth";

export default async function HealthLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getScope();
  if (user?.role !== "ADMIN") redirect("/");
  return children;
}
