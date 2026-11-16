import { describe, expect, it } from "vitest";
import { decidePortalClosure } from "@/lib/portal-closure";
import { inferPortal } from "@/lib/portal";

const site = { siteLat: 28.4595, siteLng: 77.0266 };

describe("portal closure", () => {
  it("leaves a direct ticket on the existing close path", () => {
    expect(decidePortalClosure({ portal: "NONE", channel: "desk", photos: 0, otpVerified: false })).toEqual({ kind: "standard" });
    expect(decidePortalClosure({ portal: null, channel: "field", photos: 0, otpVerified: false })).toEqual({ kind: "standard" });
  });

  it("parks an office close for a portal ticket", () => {
    const decision = decidePortalClosure({ portal: "HAREDA", channel: "desk", photos: 2, otpVerified: true, lat: site.siteLat, lng: site.siteLng, ...site });
    expect(decision.kind).toBe("pending");
  });

  it("closes a field visit with photo, OTP, and GPS within 100 m", () => {
    const decision = decidePortalClosure({
      portal: "MSEDCL",
      channel: "field",
      photos: 1,
      otpVerified: true,
      lat: site.siteLat + 0.0003,
      lng: site.siteLng,
      ...site,
    });
    expect(decision.kind).toBe("close");
    if (decision.kind === "close") {
      expect(decision.siteUnpinned).toBe(false);
      expect(decision.distanceM).toBeLessThanOrEqual(100);
    }
  });

  it("closes and flags GPS when the site has no coordinates", () => {
    const decision = decidePortalClosure({
      portal: "KREDL",
      channel: "field",
      photos: 1,
      otpVerified: true,
      lat: 15.3,
      lng: 75.1,
      siteLat: null,
      siteLng: null,
    });
    expect(decision).toEqual({ kind: "close", distanceM: null, siteUnpinned: true });
  });

  it("parks a field close that is missing proof or is too far", () => {
    const missing = decidePortalClosure({ portal: "MEDA", channel: "field", photos: 0, otpVerified: false, lat: null, lng: null, ...site });
    expect(missing.kind).toBe("pending");
    const far = decidePortalClosure({
      portal: "PM_KUSUM",
      channel: "field",
      photos: 1,
      otpVerified: true,
      lat: site.siteLat + 0.01,
      lng: site.siteLng,
      ...site,
    });
    expect(far.kind).toBe("pending");
    if (far.kind === "pending") expect(far.reason).toContain("100 m");
  });
});

describe("portal inference", () => {
  it("uses an explicit tag, MSEDCL columns, or an unambiguous state", () => {
    expect(inferPortal({ portal: "hareda" })).toBe("HAREDA");
    expect(inferPortal({ msedclRequestNo: "REQ-1" })).toBe("MSEDCL");
    expect(inferPortal({ stateName: "Haryana", schemeName: "Solar pump", saralId: "S1" })).toBe("HAREDA");
    expect(inferPortal({ stateName: "Karnataka", callType: "SCHEME" })).toBe("KREDL");
    expect(inferPortal({ stateName: "Maharashtra", schemeName: "Solar pump" })).toBeNull();
    expect(inferPortal({ schemeName: "KUSUM" })).toBeNull();
    expect(inferPortal({ schemeName: "PM-KUSUM" })).toBe("PM_KUSUM");
  });
});
