import { describe, expect, it } from "vitest";
import { DEFAULT_SLA_HOURS } from "../src/lib/labels";
import { DEFAULT_PROOF } from "../src/lib/phase3";
import { COMPANIES, PROOF_DEFAULT, SLA_HOURS, adminBootstrapError, newPasswordError } from "../scripts/bootstrap-rules.mjs";

describe("production bootstrap", () => {
  it("keeps the two real companies and the SLA hours used by the desk", () => {
    expect(COMPANIES.map((row) => row.code)).toEqual(["PUMPS", "SOLAR"]);
    expect(SLA_HOURS).toEqual(DEFAULT_SLA_HOURS);
    expect(PROOF_DEFAULT).toEqual(DEFAULT_PROOF);
  });

  it("asks for an admin only when the database has no users", () => {
    expect(adminBootstrapError(0, "", "long-enough")).toBe("Set ADMIN_EMAIL before the first start");
    expect(adminBootstrapError(0, "owner@oswalpumps.com", "short")).toBe("Use at least 8 characters");
    expect(adminBootstrapError(0, "owner@oswalpumps.com", "a-real-password")).toBeNull();
    expect(adminBootstrapError(3, "", "")).toBeNull();
  });

  it("rejects a short or unchanged password", () => {
    expect(newPasswordError("tiny", false)).toBe("Use at least 8 characters");
    expect(newPasswordError("a-real-password", true)).toBe("Choose a different password");
    expect(newPasswordError("a-real-password", false)).toBeNull();
  });
});
