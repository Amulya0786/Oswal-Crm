const DEFAULT_LIMIT = "8";

/** Keep in step with src/server/db-url.ts. Bootstrap runs as plain Node, so it cannot import the TypeScript file. */
export function applyPoolParams(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return trimmed;
  try {
    const url = new URL(trimmed);
    url.searchParams.set("connection_limit", poolLimit(url.searchParams.get("connection_limit")));
    url.searchParams.set("pgbouncer", "true");
    return url.toString();
  } catch {
    return appendPoolParams(trimmed);
  }
}

export function runtimeDatabaseUrl(raw) {
  if (!raw?.trim()) return undefined;
  return applyPoolParams(raw);
}

function poolLimit(current) {
  if (current == null || current === "") return DEFAULT_LIMIT;
  const n = Number(current);
  if (!Number.isInteger(n) || n < 8 || n > 10) return DEFAULT_LIMIT;
  return String(n);
}

function appendPoolParams(raw) {
  const withoutLimit = raw.replace(/([?&])connection_limit=[^&]*/g, "$1").replace(/[?&]$/, "");
  const withoutBouncer = withoutLimit.replace(/([?&])pgbouncer=[^&]*/g, "$1").replace(/[?&]$/, "");
  const join = withoutBouncer.includes("?") ? "&" : "?";
  return `${withoutBouncer}${join}connection_limit=${DEFAULT_LIMIT}&pgbouncer=true`;
}
