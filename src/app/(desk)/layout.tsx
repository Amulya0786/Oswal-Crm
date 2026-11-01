import { redirect } from "next/navigation";
import { getScope } from "@/server/auth";
import { getVersion } from "@/server/db";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const { user, scope } = await getScope();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/password");
  const version = await getVersion();
  return <Shell user={user} scope={scope} version={version}>{children}</Shell>;
}
