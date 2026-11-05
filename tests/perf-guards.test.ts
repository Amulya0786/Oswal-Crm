import { readdirSync, readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { filterSql, type RiskContext } from "@/server/scope";
import { applyPoolParams } from "@/server/db-url";
import { applyPoolParams as applyPoolParamsJs } from "../scripts/db-url.mjs";
import { forget, remember } from "@/server/memory-cache";

const ctx: RiskContext = { now: new Date("2026-11-04T12:00:00Z"), loadIds: [], loadCounts: new Map(), hist: {} };

describe("search uses indexed columns", () => {
  it("matches serials on serialNorm and the other trigram columns without a wrapper", () => {
    const sql = filterSql({ q: "HSO-2707" }, ctx);
    const text = sql.strings.join(" ");
    expect(text).toContain('"serialNorm"');
    expect(text).toContain('"serialNo"');
    expect(text).not.toContain("COALESCE");
    expect(text).toContain('"ticketNo"');
    expect(text).toContain('"saralId"');
    expect(text).toContain('"assignedName"');
    expect(text).toContain('"productDetails"');
    expect(sql.values).toContain("%HSO2707%");
  });
});

describe("pool url", () => {
  const direct = "postgresql://user:s3cret@127.0.0.1:5432/oswal?schema=public&sslmode=require";

  it("adds a small pool and pgbouncer mode for a direct url", () => {
    const next = applyPoolParams(direct);
    const url = new URL(next);
    expect(url.searchParams.get("connection_limit")).toBe("8");
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("schema")).toBe("public");
    expect(url.username).toBe("user");
    expect(url.password).toBe("s3cret");
    expect(applyPoolParamsJs(direct)).toBe(next);
  });

  it("keeps an explicit limit of 8, 9, or 10", () => {
    const next = applyPoolParams(`${direct}&connection_limit=10`);
    expect(new URL(next).searchParams.get("connection_limit")).toBe("10");
    expect(applyPoolParamsJs(`${direct}&connection_limit=10`)).toBe(next);
  });

  it("shrinks a pool above 10", () => {
    const next = applyPoolParams(`${direct}&connection_limit=17`);
    expect(new URL(next).searchParams.get("connection_limit")).toBe("8");
  });
});

describe("memory cache", () => {
  it("reuses a value for the ttl and refreshes when asked", async () => {
    forget("perf-test");
    let n = 0;
    const load = async () => {
      n += 1;
      return n;
    };
    expect(await remember("perf-test", "k", 60_000, load, { cache: true })).toBe(1);
    expect(await remember("perf-test", "k", 60_000, load, { cache: true })).toBe(1);
    expect(await remember("perf-test", "k", 60_000, load, { cache: true, refresh: true })).toBe(2);
  });
});

describe("search index migrations", () => {
  it("creates each trigram index in its own non-transactional statement", () => {
    const root = path.resolve("prisma/migrations");
    const names = [
      "20261104173100_search_trgm_saral",
      "20261104173200_search_trgm_assigned",
      "20261104173300_search_trgm_product",
    ];
    const found = readdirSync(root).filter((name) => names.includes(name)).sort();
    expect(found).toEqual(names);
    for (const name of names) {
      const sql = readFileSync(path.join(root, name, "migration.sql"), "utf8");
      const statements = sql
        .replace(/--[^\n]*/g, "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(1);
      expect(statements[0]).toMatch(/^CREATE INDEX CONCURRENTLY IF NOT EXISTS/);
      expect(statements[0]).toContain("gin_trgm_ops");
    }
  });
});
