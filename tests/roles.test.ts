import { describe, expect, it } from "vitest";
import { formatTicketNo } from "../src/lib/ticket";
import { whatsAppPostAllowed } from "../src/server/whatsapp";
import { capabilities } from "../src/server/auth";
import { canSee } from "../src/server/scope";
import { pathAllowed } from "../src/lib/access";
import { DISTRICTS, SCHEMES, STATES } from "../src/data/reference.mjs";
import { parsePincodeCsv } from "../src/data/reference.mjs";
import type { SessionUser } from "../src/lib/types";

function user(role: SessionUser["role"], extra: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u1",
    name: "Test",
    email: "t@oswal.test",
    role,
    phone: null,
    isTest: false,
    mustChangePassword: false,
    engineerId: null,
    companies: [],
    companyIds: ["co"],
    stateIds: [],
    districtIds: [],
    brandIds: [],
    caps: capabilities(role),
    ...extra,
  };
}

const row = {
  companyId: "co",
  districtId: null,
  stateId: null,
  engineerId: null,
  createdById: "someone",
  brandId: "brand-a",
};

describe("roles", () => {
  it("keeps the call centre to booking, notes and happy calling", () => {
    const caps = capabilities("CALL_CENTRE");
    expect(caps.book).toBe(true);
    expect(caps.note).toBe(true);
    expect(caps.happy).toBe(true);
    expect(caps.assign).toBe(false);
    expect(caps.close).toBe(false);
    expect(caps.cancel).toBe(false);
    expect(caps.hold).toBe(false);
    expect(caps.reopen).toBe(false);
    expect(caps.masterView).toBe(false);
    expect(caps.import).toBe(false);
    expect(caps.report).toBe(false);
    expect(caps.export).toBe(false);
    expect(caps.analytics).toBe(false);
    expect(caps.settings).toBe(false);
    expect(pathAllowed("CALL_CENTRE", "/complaints/book")).toBe(true);
    expect(pathAllowed("CALL_CENTRE", "/reports")).toBe(false);
    expect(pathAllowed("CALL_CENTRE", "/import")).toBe(false);
  });

  it("limits an OEM partner to their brands", () => {
    const caps = capabilities("OEM_PARTNER");
    expect(caps.book).toBe(true);
    expect(caps.note).toBe(true);
    expect(caps.report).toBe(true);
    expect(caps.export).toBe(true);
    expect(caps.assign).toBe(false);
    expect(caps.close).toBe(false);
    expect(caps.masterView).toBe(false);
    expect(caps.settings).toBe(false);
    const partner = user("OEM_PARTNER", { brandIds: ["brand-a"] });
    expect(canSee(partner, "all", row)).toBe(true);
    expect(canSee(partner, "all", { ...row, brandId: "brand-b" })).toBe(false);
    expect(canSee(user("OEM_PARTNER"), "all", row)).toBe(false);
    const desk = user("CALL_CENTRE", { brandIds: ["brand-b"] });
    expect(canSee(desk, "all", row)).toBe(true);
    expect(pathAllowed("OEM_PARTNER", "/masters")).toBe(false);
    expect(pathAllowed("OEM_PARTNER", "/reports")).toBe(true);
  });
});

describe("ticket numbers and webhook", () => {
  it("uses three digits through 999 and grows after that", () => {
    const day = new Date("2026-11-01T10:00:00+05:30");
    expect(formatTicketNo(day, 7)).toMatch(/007$/);
    expect(formatTicketNo(day, 999)).toMatch(/999$/);
    expect(formatTicketNo(day, 1000)).toMatch(/1000$/);
  });

  it("rejects a WhatsApp post in production when no secret is set", () => {
    const previous = process.env.NODE_ENV;
    const app = process.env.WHATSAPP_APP_SECRET;
    const hook = process.env.WHATSAPP_WEBHOOK_SECRET;
    const verify = process.env.WHATSAPP_VERIFY_TOKEN;
    process.env.NODE_ENV = "production";
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_SECRET;
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    expect(whatsAppPostAllowed("{}", null, null)).toBe(false);
    process.env.WHATSAPP_WEBHOOK_SECRET = "shared-secret";
    expect(whatsAppPostAllowed("{}", null, "shared-secret")).toBe(true);
    process.env.NODE_ENV = previous;
    if (app === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = app;
    if (hook === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET;
    else process.env.WHATSAPP_WEBHOOK_SECRET = hook;
    if (verify === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = verify;
  });
});

describe("reference lists", () => {
  it("covers the states, Karnal, and PM-KUSUM without duplicate districts", () => {
    expect(STATES).toHaveLength(36);
    expect(DISTRICTS.Haryana).toContain("Karnal");
    expect(DISTRICTS.Ladakh).toEqual(["Kargil", "Leh"]);
    expect(SCHEMES).toContain("PM-KUSUM");
    for (const [name, districts] of Object.entries(DISTRICTS)) {
      expect(new Set(districts).size).toBe(districts.length);
      expect(STATES.some((state) => state[0] === name)).toBe(true);
    }
  });

  it("reads a pincode file and skips the header", () => {
    const rows = parsePincodeCsv("pincode,district,state\n132001,Karnal,Haryana\nbad,Karnal,Haryana");
    expect(rows).toEqual([{ code: "132001", district: "Karnal", state: "Haryana" }]);
  });
});
