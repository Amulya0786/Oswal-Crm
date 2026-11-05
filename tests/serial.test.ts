import { describe, expect, it } from "vitest";
import { resolveSerial, validateSerial } from "../src/lib/quality";
import { bookingConflicts } from "../src/lib/duplicates";
import { zoned } from "../src/lib/time";

describe("serial at booking", () => {
  it("rejects junk and keeps a real serial", () => {
    expect(validateSerial("0").ok).toBe(false);
    expect(validateSerial("1234").ok).toBe(false);
    expect(validateSerial("11111").ok).toBe(false);
    expect(validateSerial("123").ok).toBe(false);
    expect(validateSerial("no").ok).toBe(false);
    const ok = validateSerial("hso-2707");
    expect(ok).toEqual({ ok: true, serial: "HSO2707" });
  });

  it("stores null when the serial is genuinely unavailable", () => {
    const missing = resolveSerial({ serial: "  ", unavailable: true, reason: "STICKER_MISSING" });
    expect(missing).toEqual({ ok: true, serial: null, pending: true, reason: "STICKER_MISSING" });
    expect(resolveSerial({ serial: "", unavailable: false, reason: null }).ok).toBe(false);
    expect(resolveSerial({ serial: "0", unavailable: true, reason: "OTHER" }).ok).toBe(false);
  });

  it("falls back to mobile, customer, product and district when there is no serial", () => {
    const now = zoned(2026, 11, 1, 12, 0);
    const rows = [{
      id: "1",
      ticketNo: "OPL261101001",
      status: "OPEN",
      bookDate: now,
      closedAt: null,
      cancelledAt: null,
      companyId: "co",
      phone: "9811111111",
      serialNo: null,
      serialNorm: null,
      customerId: "c1",
      customerName: "Ramesh Kumar",
      productId: "p1",
      districtId: "d1",
      capacityLabel: "5 HP",
      productDetails: "5 HP Solar Pump",
    }];
    const hit = bookingConflicts(rows, {
      phone: "9811111111",
      serialNo: null,
      customerName: "ramesh kumar",
      productId: "p1",
      districtId: "d1",
      companyId: "co",
    }, now);
    expect(hit.blocking[0]?.ticketNo).toBe("OPL261101001");
    expect(hit.sameDay).toHaveLength(1);
    const otherDistrict = bookingConflicts(rows, {
      phone: "9811111111",
      serialNo: null,
      customerName: "Ramesh Kumar",
      productId: "p1",
      districtId: "other",
      companyId: "co",
    }, now);
    expect(otherDistrict.blocking).toHaveLength(0);
  });

  it("matches an open ticket on serial and ignores a different serial", () => {
    const now = zoned(2026, 11, 1, 12, 0);
    const rows = [{
      id: "1",
      ticketNo: "OPL261101002",
      status: "ASSIGNED",
      bookDate: zoned(2026, 10, 20, 10, 0),
      closedAt: null,
      cancelledAt: null,
      companyId: "co",
      phone: "9800000000",
      serialNo: "HSO2707",
      serialNorm: "HSO2707",
      customerId: null,
      customerName: "Other",
      productId: "px",
      districtId: "dx",
    }];
    const hit = bookingConflicts(rows, { phone: "9999999999", serialNo: "hso-2707", customerName: "New", companyId: "co" }, now);
    expect(hit.blocking[0]?.basis).toBe("same serial");
    expect(hit.sameDay).toHaveLength(0);
  });
});
