export type HealthBody = {
  status: "ok" | "error";
  ok: boolean;
  db: boolean;
  service: "oswal-service";
  latencyMs: number;
  checks: {
    db: { ok: boolean; latencyMs: number };
    pool: { ok: boolean; limit: number; pgbouncer: true };
  };
};

/** Shape returned to an uptime monitor. No host names or credentials. */
export function healthBody(input: { dbOk: boolean; dbMs: number; totalMs: number; limit: number }): HealthBody {
  return {
    status: input.dbOk ? "ok" : "error",
    ok: input.dbOk,
    db: input.dbOk,
    service: "oswal-service",
    latencyMs: input.totalMs,
    checks: {
      db: { ok: input.dbOk, latencyMs: input.dbMs },
      pool: { ok: input.dbOk, limit: input.limit, pgbouncer: true },
    },
  };
}
