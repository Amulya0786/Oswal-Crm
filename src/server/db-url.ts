const DEFAULT_LIMIT = "8";
/** One web instance on a 2 GB database can use a wider pool. The 1 GB database stays at 8. */
export const POOL_MAX = 20;

/**
 * Prisma reads `pgbouncer` and `connection_limit` and strips them before opening Postgres.
 * `pgbouncer=true` turns off prepared statements, which transaction-mode PgBouncer rejects.
 * On a direct connection the same flag still works.
 *
 * The pool stays at 8 until PRISMA_CONNECTION_LIMIT (or the URL) asks for another size from 1 to 20.
 * Set PRISMA_CONNECTION_LIMIT only after the database is upgraded to 2 GB. This file does not resize anything.
 */
export function applyPoolParams(raw: string): string {
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    url.searchParams.set("connection_limit", poolLimit(url.searchParams.get("connection_limit")));
    url.searchParams.set("pgbouncer", "true");
    return url.toString();
  } catch {
    return appendPoolParams(trimmed);
  }
}

export function runtimeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  return applyPoolParams(raw);
}

/** Numbers only. The database URL is not returned. */
export function configuredPool(): { limit: number; pgbouncer: true } {
  const raw = process.env.DATABASE_URL;
  if (!raw?.trim()) return { limit: Number(DEFAULT_LIMIT), pgbouncer: true };
  try {
    const applied = new URL(applyPoolParams(raw));
    return {
      limit: Number(applied.searchParams.get("connection_limit") ?? DEFAULT_LIMIT),
      pgbouncer: true,
    };
  } catch {
    return { limit: Number(DEFAULT_LIMIT), pgbouncer: true };
  }
}

export function poolLimit(current: string | null, envValue = process.env.PRISMA_CONNECTION_LIMIT): string {
  const fromEnv = acceptedLimit(envValue);
  if (fromEnv) return fromEnv;
  const fromUrl = acceptedLimit(current);
  if (fromUrl) return fromUrl;
  return DEFAULT_LIMIT;
}

function acceptedLimit(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > POOL_MAX) return null;
  return String(n);
}

function appendPoolParams(raw: string): string {
  const withoutLimit = raw.replace(/([?&])connection_limit=[^&]*/g, "$1").replace(/[?&]$/, "");
  const withoutBouncer = withoutLimit.replace(/([?&])pgbouncer=[^&]*/g, "$1").replace(/[?&]$/, "");
  const join = withoutBouncer.includes("?") ? "&" : "?";
  return `${withoutBouncer}${join}connection_limit=${poolLimit(null)}&pgbouncer=true`;
}
