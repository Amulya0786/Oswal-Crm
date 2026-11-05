import { describe, expect, it } from "vitest";
import { rankEngineers, scoreEngineer, type EngineerCandidate } from "@/lib/assignment";

const base: EngineerCandidate = {
  id: "e1",
  name: "Asha",
  kind: "ENGINEER",
  companyId: "pumps",
  stateId: "hr",
  districtId: "karnal",
  districtIds: ["karnal"],
  pincodes: "132001",
  skills: "PUMPS,BREAKDOWN",
  category: "Domestic",
  active: true,
};

describe("state-first assignment", () => {
  it("rejects a technician from another state", () => {
    const score = scoreEngineer({ ...base, stateId: "pb" }, { companyId: "pumps", stateId: "hr" }, 1, 0.9);
    expect(score.score).toBe(-1);
  });

  it("gives a district bonus and keeps pincode optional", () => {
    const withPin = scoreEngineer(base, { companyId: "pumps", stateId: "hr", districtId: "karnal", pincode: "132001" }, 1, 0.2);
    const without = scoreEngineer({ ...base, pincodes: "" }, { companyId: "pumps", stateId: "hr", districtId: "karnal" }, 1, 0.9);
    expect(withPin.score).toBeGreaterThan(without.score);
    expect(without.score).toBeGreaterThan(0);
    expect(without.reason).toContain("District list");
  });

  it("penalises a full day and uses close rate only to break ties", () => {
    const busy = scoreEngineer(base, { companyId: "pumps", stateId: "hr", dailyCap: 8 }, 8, 0.99);
    const free = scoreEngineer({ ...base, id: "e2", name: "Bala" }, { companyId: "pumps", stateId: "hr", dailyCap: 8 }, 1, 0.1);
    expect(free.score).toBeGreaterThan(busy.score);
    const ranked = rankEngineers(
      [base, { ...base, id: "e2", name: "Bala" }],
      { companyId: "pumps", stateId: "hr" },
      new Map([["e1", 1], ["e2", 1]]),
      new Map([["e1", 0.2], ["e2", 0.8]]),
    );
    expect(ranked[0].closeRate).toBeGreaterThanOrEqual(ranked[1].closeRate);
  });

  it("does not score a punch-in bonus", () => {
    const score = scoreEngineer(base, { companyId: "pumps", stateId: "hr" }, 1, 0.5);
    expect(score.reason).not.toContain("Punched in");
    expect(score.score).toBeGreaterThan(0);
  });

  it("flags the third repeat for a senior", () => {
    const score = scoreEngineer(base, { companyId: "pumps", stateId: "hr", repeatCount: 3, previousEngineerId: "e1" }, 1, 0.5);
    expect(score.senior).toBe(true);
    expect(score.reason).toContain("Previous technician");
  });
});
