import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { archiveCutoff, shouldArchive } from "@/lib/archive";
import { cookieFlags } from "@/lib/cookies";
import { healthBody } from "@/lib/health";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/password";
import { compareCounts } from "@/lib/restore-counts";
import { filterSql, type RiskContext } from "@/server/scope";

const ctx: RiskContext = { now: new Date("2026-11-16T12:00:00Z"), loadIds: [], loadCounts: new Map(), hist: {} };

describe("health payload", () => {
  it("reports status, database latency, and the pool limit", () => {
    const body = healthBody({ dbOk: true, dbMs: 12, totalMs: 14, limit: 8 });
    expect(body.status).toBe("ok");
    expect(body.ok).toBe(true);
    expect(body.db).toBe(true);
    expect(body.latencyMs).toBe(14);
    expect(body.checks.db).toEqual({ ok: true, latencyMs: 12 });
    expect(body.checks.pool).toEqual({ ok: true, limit: 8, pgbouncer: true });
    expect(JSON.stringify(body)).not.toMatch(/postgres/i);
  });

  it("fails closed when the database check fails", () => {
    const body = healthBody({ dbOk: false, dbMs: 30, totalMs: 31, limit: 8 });
    expect(body.status).toBe("error");
    expect(body.ok).toBe(false);
    expect(body.checks.pool.ok).toBe(false);
  });
});

describe("archive", () => {
  const now = new Date("2026-11-16T00:00:00Z");

  it("archives a ticket closed more than 12 months ago", () => {
    expect(shouldArchive("CLOSED", new Date("2025-11-01T00:00:00Z"), null, now)).toBe(true);
    expect(shouldArchive("CANCELLED", null, new Date("2024-01-01T00:00:00Z"), now)).toBe(true);
  });

  it("keeps a recent close and an open ticket on the live lists", () => {
    expect(shouldArchive("CLOSED", new Date("2026-06-01T00:00:00Z"), null, now)).toBe(false);
    expect(shouldArchive("OPEN", new Date("2020-01-01T00:00:00Z"), null, now)).toBe(false);
    expect(archiveCutoff(now).getMonth()).toBe(now.getMonth());
  });

  it("hides archived tickets unless the list asks for them", () => {
    const hidden = filterSql({}, ctx).strings.join(" ");
    expect(hidden).toContain('"archived"');
    const included = filterSql({ archived: "1" }, ctx).strings.join(" ");
    expect(included).not.toContain('"archived"');
    const only = filterSql({ archived: "only" }, ctx).strings.join(" ");
    expect(only).toContain('"archived"');
    expect(only).toContain("= true");
    expect(filterSql({}, ctx).strings.join(" ")).toContain("= false");
  });
});

describe("login safety", () => {
  it("rejects a password shorter than the shared minimum", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(10);
    expect(passwordProblem("too-short")).toMatch(/10/);
    expect(passwordProblem("a-real-password")).toBeNull();
  });

  it("sets the Secure cookie flag when asked", () => {
    const previous = process.env.COOKIE_SECURE;
    process.env.COOKIE_SECURE = "1";
    try {
      expect(cookieFlags(true, 60).secure).toBe(true);
      expect(cookieFlags(true, 60).httpOnly).toBe(true);
      expect(cookieFlags(true, 60).sameSite).toBe("lax");
    } finally {
      if (previous == null) delete process.env.COOKIE_SECURE;
      else process.env.COOKIE_SECURE = previous;
    }
  });
});

describe("restore counts", () => {
  it("lists tables whose counts differ", () => {
    const mismatches = compareCounts({ Complaint: 10, User: 2 }, { Complaint: 10, User: 3, Customer: 1 });
    expect(mismatches).toEqual([
      { table: "User", actual: 2, expected: 3 },
      { table: "Customer", actual: -1, expected: 1 },
    ]);
    expect(compareCounts({ Complaint: 4 }, { Complaint: 4 })).toEqual([]);
  });
});

describe("hot indexes", () => {
  it("puts each concurrent index in its own migration", () => {
    const root = path.resolve("prisma/migrations");
    const names = [
      "20261116211100_hot_status_state_created",
      "20261116211200_hot_created_at",
      "20261116211300_hot_archived_status",
      "20261116211400_hot_archived_portal",
    ];
    for (const name of names) {
      const sql = readFileSync(path.join(root, name, "migration.sql"), "utf8");
      const statements = sql.replace(/--[^\n]*/g, "").split(";").map((part) => part.trim()).filter(Boolean);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toMatch(/^CREATE INDEX CONCURRENTLY IF NOT EXISTS/);
    }
    expect(readdirSync(root)).toContain("20261116211000_archive_and_jobs");
  });
});
