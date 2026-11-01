import { prisma } from "@/server/db";

export async function ImportBanner() {
  const row = await prisma.appSetting.findUnique({ where: { key: "importRunning" } });
  if (row?.value !== "1") return null;
  return <div className="banner">Import in progress, counts may change</div>;
}
