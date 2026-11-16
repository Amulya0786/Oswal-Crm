import { describe, expect, it } from "vitest";
import { filterSql, type RiskContext } from "@/server/scope";
import { becameReassigned } from "@/lib/reassign";

const ctx: RiskContext = { now: new Date("2026-11-16T08:00:00Z"), loadIds: [], loadCounts: new Map(), hist: {} };

function text(filters: Parameters<typeof filterSql>[0]) {
  return filterSql(filters, ctx).strings.join(" ");
}

describe("complaint filters", () => {
  it("searches the MSEDCL request number and the beneficiary or portal number", () => {
    const sql = text({ q: "REQ-100" });
    expect(sql).toContain('"msedclRequestNo"');
    expect(sql).toContain('"portalNo"');
    expect(sql).toContain('"saralId"');
  });

  it("filters schedule dates, hold, nature, reassignment, and portal", () => {
    const sql = text({
      dateOn: "schedule",
      from: "01/11/2026",
      to: "16/11/2026",
      hold: "1",
      natureId: "nature-1",
      categoryId: "cat-1",
      reassigned: "1",
      portal: "HAREDA",
    });
    expect(sql).toContain('"scheduleDate"');
    expect(sql).toContain('"reassignedOnce"');
    expect(sql).toContain('"natureId"');
    expect(sql).toContain('"categoryId"');
    expect(sql).toContain("PENDING");
    expect(sql).toContain('"portal"');
  });
});

describe("reassignment tracking", () => {
  it("marks a ticket only when a technician was already assigned", () => {
    expect(becameReassigned(null, "eng-2")).toBe(false);
    expect(becameReassigned("eng-1", "eng-2")).toBe(true);
    expect(becameReassigned("eng-1", null)).toBe(false);
  });
});
