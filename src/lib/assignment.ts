export type EngineerCandidate = {
  id: string;
  name: string;
  kind: string;
  companyId: string;
  stateId: string | null;
  districtId: string | null;
  pincodes: string;
  skills: string;
  active: boolean;
};

export type AssignmentScore = {
  engineerId: string;
  name: string;
  score: number;
  openCount: number;
  closeRate: number;
  reason: string;
};

const SKILL_BY_TYPE: Record<string, string[]> = {
  SUBMERSIBLE: ["SUBMERSIBLE"],
  MONOBLOCK: ["MONOBLOCK"],
  OPENWELL: ["OPENWELL"],
  JET: ["JET", "MONOBLOCK"],
  SOLAR: ["SOLAR"],
  CONTROLLER: ["CONTROLLER", "SOLAR"],
  PANEL: ["PANEL", "SOLAR"],
  ACCESSORY: ["SOLAR", "SUBMERSIBLE"],
};

export function scoreEngineer(
  engineer: EngineerCandidate,
  input: { companyId: string; pincode?: string | null; districtId?: string | null; stateId?: string | null; productType?: string | null; callType?: string | null },
  openCount: number,
  closeRate: number,
): AssignmentScore {
  const reasons: string[] = [];
  let score = 0;
  if (!engineer.active || engineer.companyId !== input.companyId) {
    return { engineerId: engineer.id, name: engineer.name, score: -1, openCount, closeRate, reason: "Not available for this company" };
  }
  const pins = engineer.pincodes.split(/[,\s]+/).map((pin) => pin.trim()).filter(Boolean);
  if (input.pincode && pins.includes(input.pincode)) {
    score += 50;
    reasons.push("Pincode match");
  } else if (input.districtId && engineer.districtId === input.districtId) {
    score += 30;
    reasons.push("Same district");
  } else if (input.stateId && engineer.stateId === input.stateId) {
    score += 8;
    reasons.push("Same state");
  }
  const skills = engineer.skills.toUpperCase().split(/[,\s]+/).filter(Boolean);
  const wanted = new Set<string>();
  if (input.productType) {
    for (const skill of SKILL_BY_TYPE[input.productType.toUpperCase()] ?? [input.productType.toUpperCase()]) wanted.add(skill);
  }
  if (input.callType === "INSTALLATION" || input.callType === "SCHEME") wanted.add("INSTALLATION");
  if (input.callType === "SCHEME") wanted.add("SOLAR");
  if ([...wanted].some((skill) => skills.includes(skill))) {
    score += 25;
    reasons.push("Skill match");
  }
  if (engineer.kind === "ENGINEER") score += 4;
  const loadScore = Math.max(0, 20 - Math.round(Math.log2(openCount + 1) * 4));
  score += loadScore;
  reasons.push(`${openCount} open`);
  if (closeRate > 0) {
    score += Math.round(closeRate * 16);
    reasons.push(`${Math.round(closeRate * 100)}% close rate`);
  }
  if (!reasons.length) reasons.push("No coverage match");
  return { engineerId: engineer.id, name: engineer.name, score, openCount, closeRate, reason: reasons.join(" · ") };
}

export function rankEngineers(
  engineers: EngineerCandidate[],
  input: { companyId: string; pincode?: string | null; districtId?: string | null; stateId?: string | null; productType?: string | null; callType?: string | null },
  openCounts: Map<string, number>,
  closeRates: Map<string, number>,
) {
  return engineers
    .map((engineer) => scoreEngineer(engineer, input, openCounts.get(engineer.id) ?? 0, closeRates.get(engineer.id) ?? 0))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.openCount - b.openCount || a.name.localeCompare(b.name));
}
