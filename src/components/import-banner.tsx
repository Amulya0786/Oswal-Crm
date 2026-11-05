import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { phrase } from "@/lib/desk-copy";

export async function ImportBanner() {
  const row = await prisma.appSetting.findUnique({ where: { key: "importRunning" } });
  if (row?.value !== "1") return null;
  const lang = (await cookies()).get("oswal_lang")?.value === "hi" ? "hi" : "en";
  return <div className="banner">{phrase(lang, "Import in progress, counts may change")}</div>;
}
