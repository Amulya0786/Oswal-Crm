import { describe, expect, it } from "vitest";
import { ageBucket, ageingBounds, istMidnight } from "@/lib/time";

const now = istMidnight(2026, 11, 16);

describe("ageing buckets", () => {
  it("uses 0–7, 8–15, 16–30, and older than 30 days", () => {
    expect(ageBucket(istMidnight(2026, 11, 16), now)).toBe("0–7 days");
    expect(ageBucket(istMidnight(2026, 11, 9), now)).toBe("0–7 days");
    expect(ageBucket(istMidnight(2026, 11, 8), now)).toBe("8–15 days");
    expect(ageBucket(istMidnight(2026, 11, 1), now)).toBe("8–15 days");
    expect(ageBucket(istMidnight(2026, 10, 31), now)).toBe("16–30 days");
    expect(ageBucket(istMidnight(2026, 10, 17), now)).toBe("16–30 days");
    expect(ageBucket(istMidnight(2026, 10, 16), now)).toBe("30+ days");
  });

  it("filters the same edges the labels use", () => {
    const week = ageingBounds("0-7", now);
    const mid = ageingBounds("8-15", now);
    const month = ageingBounds("16-30", now);
    const older = ageingBounds("30+", now);
    expect(week?.gte?.toISOString()).toBe(istMidnight(2026, 11, 9).toISOString());
    expect(week?.lt?.toISOString()).toBe(istMidnight(2026, 11, 17).toISOString());
    expect(mid?.gte?.toISOString()).toBe(istMidnight(2026, 11, 1).toISOString());
    expect(mid?.lt?.toISOString()).toBe(week?.gte?.toISOString());
    expect(month?.lt?.toISOString()).toBe(mid?.gte?.toISOString());
    expect(older?.lt?.toISOString()).toBe(month?.gte?.toISOString());
    expect(ageingBounds("0-2", now)).toBeNull();
  });
});