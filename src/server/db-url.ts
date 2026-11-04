const DEFAULT_LIMIT = "8";

/**
 * Prisma reads `pgbouncer` and `connection_limit` and strips them before opening Postgres.
 * `pgbouncer=true` turns off prepared statements, which transaction-mode PgBouncer rejects.
 * On a direct connection the same flag still works. The pool stays at 8 unless the URL
 * already asks for 8, 9, or 10.
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

function poolLimit(current: string | null): string {
  if (current == null || current === "") return DEFAULT_LIMIT;
  const n = Number(current);
  if (!Number.isInteger(n) || n < 8 || n > 10) return DEFAULT_LIMIT;
  return String(n);
}

function appendPoolParams(raw: string): string {
  const withoutLimit = raw.replace(/([?&])connection_limit=[^&]*/g, "$1").replace(/[?&]$/, "");
  const withoutBouncer = withoutLimit.replace(/([?&])pgbouncer=[^&]*/g, "$1").replace(/[?&]$/, "");
  const join = withoutBouncer.includes("?") ? "&" : "?";
  return `${withoutBouncer}${join}connection_limit=${DEFAULT_LIMIT}&pgbouncer=true`;
}
