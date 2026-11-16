declare module "@/server/load-reference.mjs" {
  export function loadReference(prisma: unknown): Promise<{ created: number }>;
  export function importPincodes(prisma: unknown, rows: { code: string; district: string; state: string }[]): Promise<{ created: number; skipped: number }>;
}

declare module "@/data/reference.mjs" {
  export const DISTRICTS: Record<string, string[]>;
  export const SCHEMES: string[];
  export const STATES: [string, string, string][];
  export function parsePincodeCsv(text: string): { code: string; district: string; state: string }[];
}
