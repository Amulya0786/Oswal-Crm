const DEFAULT_LIMIT = "8";
const POOL_MAX = 20;

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

export function poolLimit(current, envValue = process.env.PRISMA_CONNECTION_LIMIT) {
  const fromEnv = acceptedLimit(envValue);
  if (fromEnv) return fromEnv;
  const fromUrl = acceptedLimit(current);
  if (fromUrl) return fromUrl;
  return DEFAULT_LIMIT;
}

function acceptedLimit(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > POOL_MAX) return null;
  return String(n);
}

function appendPoolParams(raw) {
  const withoutLimit = raw.replace(/([?&])connection_limit=[^&]*/g, "$1").replace(/[?&]$/, "");
  const withoutBouncer = withoutLimit.replace(/([?&])pgbouncer=[^&]*/g, "$1").replace(/[?&]$/, "");
  const join = withoutBouncer.includes("?") ? "&" : "?";
  return `${withoutBouncer}${join}connection_limit=${poolLimit(null)}&pgbouncer=true`;
}
