import { describe, expect, it } from "vitest";
import {
  assetKey,
  composeRepeatReason,
  coverStatus,
  isFirstTimeFix,
  pickCustomer,
  repeatPhrase,
  repeatWindowDays,
  retargetAssets,
} from "../src/lib/history";

const person = {
  id: "c1",
  name: "Ramesh Kumar",
  phone: "9812345678",
  altPhone: null as string | null,
  extraPhones: ["9898989898"],
  pincode: "132001",
  village: "karnal",
  mergedIntoId: null as string | null,
};

describe("customer matching", () => {
  it("matches the primary mobile and an alternate", () => {
    expect(pickCustomer([person], { phone: "+91 98123 45678", name: "Someone Else" })?.basis).toBe("phone");
    expect(pickCustomer([person], { phone: "9898989898", name: "Someone Else" })?.basis).toBe("alternate");
  });

  it("falls back to the same name plus village or pincode, and refuses an ambiguous pair", () => {
    const other = { ...person, id: "c2", phone: "9000000001", extraPhones: [] };
    expect(pickCustomer([other], { phone: "9111111111", name: "Ramesh Kumar", pincode: "132001" })).toEqual({ id: "c2", basis: "name-place" });
    expect(pickCustomer([other], { phone: "9111111111", name: "Ramesh Kumar", village: "Karnal" })?.basis).toBe("name-place");
    expect(pickCustomer([other], { phone: "9111111111", name: "Ramesh Kumar" })).toBeNull();
    expect(pickCustomer([other, { ...other, id: "c3" }], { phone: "9111111111", name: "Ramesh Kumar", pincode: "132001" })).toBeNull();
  });

  it("ignores a customer that was already merged", () => {
    expect(pickCustomer([{ ...person, mergedIntoId: "kept" }], { phone: person.phone, name: person.name })).toBeNull();
  });
});

describe("assets and repeats", () => {
  it("keys a serial asset separately from an install without a serial", () => {
    const serial = assetKey({ serialNorm: "ab-10021", customerId: "c1", productId: "p1", capacityLabel: "5 HP" });
    const install = assetKey({ serialNorm: null, customerId: "c1", productId: "p1", capacityLabel: "5 HP" });
    const otherCapacity = assetKey({ serialNorm: null, customerId: "c1", productId: "p1", capacityLabel: "3 HP" });
    expect(serial).toBe("serial:AB10021");
    expect(install).not.toBe(otherCapacity);
    expect(assetKey({ serialNorm: null, customerId: "c2", productId: "p1", capacityLabel: "5 HP" })).not.toBe(install);
  });

  it("links the previous ticket and flags 30, 60 and 90 day failures", () => {
    const previous = new Date("2026-01-01T00:00:00Z");
    expect(repeatWindowDays(previous, new Date("2026-01-20T00:00:00Z"))).toBe(30);
    expect(repeatWindowDays(previous, new Date("2026-02-15T00:00:00Z"))).toBe(60);
    expect(repeatWindowDays(previous, new Date("2026-03-20T00:00:00Z"))).toBe(90);
    expect(repeatWindowDays(previous, new Date("2026-06-01T00:00:00Z"))).toBeNull();
    expect(repeatPhrase("OPL260101001", 30)).toBe("repeat of OPL260101001 · repeat failure within 30 days");
    expect(composeRepeatReason("OPL260101009", "OPL260101001", null)).toBe("Duplicate of OPL260101009 · repeat of OPL260101001");
  });

  it("treats a closure as a first-time fix only when it is not a repeat and nothing reopens inside 30 days", () => {
    const closedAt = new Date("2026-04-01T00:00:00Z");
    expect(isFirstTimeFix({ repeatWindow: null, closedAt, laterBookDates: [] })).toBe(true);
    expect(isFirstTimeFix({ repeatWindow: 30, closedAt, laterBookDates: [] })).toBe(false);
    expect(isFirstTimeFix({ repeatWindow: null, closedAt, laterBookDates: [new Date("2026-04-20T00:00:00Z")] })).toBe(false);
    expect(isFirstTimeFix({ repeatWindow: null, closedAt, laterBookDates: [new Date("2026-06-01T00:00:00Z")] })).toBe(true);
    expect(isFirstTimeFix({ repeatWindow: null, closedAt: null, laterBookDates: [] })).toBeNull();
  });

  it("folds a no-serial asset onto the surviving customer when the install key already exists", () => {
    const plan = retargetAssets("keep", [
      { id: "a1", serialNorm: "SN10021", identityKey: "serial:SN10021", productId: "p1", capacityLabel: "5 HP" },
      { id: "a2", serialNorm: null, identityKey: "install:drop:p1:5 hp", productId: "p1", capacityLabel: "5 HP" },
    ], ["install:keep:p1:5 hp"]);
    expect(plan[0]).toEqual({ id: "a1", identityKey: "serial:SN10021" });
    expect(plan[1].foldIntoKey).toBe("install:keep:p1:5 hp");
  });
});

describe("cover", () => {
  it("reads warranty and AMC from the dates on the asset", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(coverStatus({}, now)).toEqual({ warranty: "Not recorded", amc: "No AMC" });
    expect(coverStatus({ warrantyUntil: new Date("2027-01-01"), amcUntil: new Date("2026-01-01") }, now)).toEqual({
      warranty: "In warranty",
      amc: "AMC expired",
    });
  });
});
