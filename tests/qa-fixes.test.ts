import { describe, expect, it } from "vitest";
import { normalizePhone } from "../src/lib/mask";
import { applyRepeat, type RepeatRow } from "../src/server/repeats";

function row(partial: Partial<RepeatRow> & Pick<RepeatRow, "id" | "ticketNo" | "bookDate" | "status">): RepeatRow {
  return { serialNorm: null, phone: "9812345678", productId: "pump", ...partial };
}

describe("mobile numbers", () => {
  it("strips a 91 or trunk 0 and rejects every other length", () => {
    expect(normalizePhone("+91 98123 45678")).toBe("9812345678");
    expect(normalizePhone("09812345678")).toBe("9812345678");
    expect(normalizePhone("9812345678")).toBe("9812345678");
    expect(normalizePhone("98123456781")).toBe("98123456781");
    expect(normalizePhone("9198123456781")).toHaveLength(13);
    expect(/^[6-9]\d{9}$/.test(normalizePhone("98123456781"))).toBe(false);
    expect(/^[6-9]\d{9}$/.test(normalizePhone("+91 98123 45678"))).toBe(true);
  });
});

describe("repeat links", () => {
  it("links a later call to the previous closed one and walks every row", () => {
    const serials = new Map();
    const mobiles = new Map();
    const first = row({ id: "1", ticketNo: "A", bookDate: new Date("2026-01-01"), status: "CLOSED", serialNorm: "SN1" });
    const open = row({ id: "2", ticketNo: "B", bookDate: new Date("2026-02-01"), status: "OPEN", serialNorm: "SN1" });
    const again = row({ id: "3", ticketNo: "C", bookDate: new Date("2026-03-01"), status: "OPEN", serialNorm: "SN1" });
    expect(applyRepeat(first, serials, mobiles).repeatFlag).toBe(false);
    expect(applyRepeat(open, serials, mobiles)).toMatchObject({ repeatFlag: true, repeatOfTicket: "A" });
    expect(applyRepeat(again, serials, mobiles).repeatOfTicket).toBe("A");
    const sameDay = row({ id: "4", ticketNo: "D", bookDate: new Date("2026-01-01"), status: "OPEN", serialNorm: "SN1" });
    expect(applyRepeat(sameDay, new Map([["SN1", { ticketNo: "A", bookDate: first.bookDate }]]), mobiles).repeatFlag).toBe(false);
  });
});
