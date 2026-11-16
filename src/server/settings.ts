import { prisma } from "./db";

/** Desk settings live in AppSetting. Missing keys use these defaults. Recipients stay blank until the owner fills them. */
export const SETTING_DEFAULTS: Record<string, string> = {
  AUTO_ASSIGN: "0",
  ASSIGN_WAIT_HOURS: "1",
  ACCEPT_WAIT_HOURS: "2",
  DAILY_VISIT_CAP: "8",
  DAILY_SUMMARY_TO: "",
  WHATSAPP_TEMPLATE_BOOKING: "",
  WHATSAPP_TEMPLATE_ASSIGNED: "",
  ESCALATION_L1_HOURS: "4",
  ESCALATION_L2_HOURS: "12",
  ESCALATION_L1_ROLE: "STATE_HEAD",
  ESCALATION_L2_ROLE: "ADMIN",
  VISIT_RATE: "",
  HELPLINE: "",
};

export async function setting(key: string) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? SETTING_DEFAULTS[key] ?? "";
}

export async function settingNumber(key: string, fallback: number) {
  const value = Number(await setting(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export async function allSettings() {
  const rows = await prisma.appSetting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));
  return Object.entries(SETTING_DEFAULTS).map(([key, fallback]) => ({ key, value: map.get(key) ?? fallback }));
}

export async function saveSetting(key: string, value: string) {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
