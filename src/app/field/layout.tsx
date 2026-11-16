import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Technician", appleWebApp: { capable: true, title: "Oswal Field" } };

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user?.mustChangePassword) redirect("/password");
  return children;
}
