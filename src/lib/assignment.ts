export type EngineerCandidate = {
  id: string;
  name: string;
  kind: string;
  companyId: string;
  stateId: string | null;
  districtId: string | null;
  districtIds?: string[];
  pincodes: string;
  skills: string;
  category?: string | null;
  brandId?: string | null;
  active: boolean;
  punchedIn?: boolean;
  onLeave?: boolean;
  homeLat?: number | null;
  homeLng?: number | null;
  lastLat?: number | null;
  lastLng?: number | null;
};

export type AssignmentInput = {
  companyId: string;
  pincode?: string | null;
  districtId?: string | null;
  stateId?: string | null;
  productType?: string | null;
  callType?: string | null;
  brandId?: string | null;
  companyCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  dailyCap?: number;
  previousEngineerId?: string | null;
  repeatCount?: number;
};

export type AssignmentScore = {
  engineerId: string;
  name: string;
  score: number;
  openCount: number;
  closeRate: number;
  reason: string;
  senior: boolean;
};

const SKILL_BY_TYPE: Record<string, string[]> = {
  SUBMERSIBLE: ["SUBMERSIBLE", "PUMPS"],
  MONOBLOCK: ["MONOBLOCK", "PUMPS"],
  OPENWELL: ["OPENWELL", "PUMPS"],
  JET: ["JET", "MONOBLOCK", "PUMPS"],
  SOLAR: ["SOLAR"],
  CONTROLLER: ["CONTROLLER", "SOLAR"],
  PANEL: ["PANEL", "SOLAR"],
  ACCESSORY: ["SOLAR", "SUBMERSIBLE"],
};

function tokens(value: string | null | undefined) {
  return (value ?? "").toUpperCase().split(/[,\s|/]+/).map((part) => part.trim()).filter(Boolean);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function scoreEngineer(
  engineer: EngineerCandidate,
  input: AssignmentInput,
  openCount: number,
  closeRate: number,
): AssignmentScore {
  const senior = (input.repeatCount ?? 0) >= 3;
  const blank = (score: number, reason: string): AssignmentScore => ({
    engineerId: engineer.id, name: engineer.name, score, openCount, closeRate, reason, senior,
  });
  if (!engineer.active || engineer.companyId !== input.companyId) return blank(-1, "Not available for this company");
  if (engineer.onLeave) return blank(-1, "On approved leave");
  if (input.stateId && engineer.stateId !== input.stateId) return blank(-1, "Different state");
  if (!input.stateId && !engineer.stateId) return blank(-1, "No state on the complaint");

  const reasons: string[] = [];
  let score = 40;
  reasons.push("Same state");

  const districts = new Set([...(engineer.districtIds ?? []), engineer.districtId].filter(Boolean) as string[]);
  if (input.districtId && districts.has(input.districtId)) {
    score += 25;
    reasons.push("District list");
  }

  const pins = engineer.pincodes.split(/[,\s]+/).map((pin) => pin.trim()).filter(Boolean);
  if (input.pincode && pins.includes(input.pincode)) {
    score += 10;
    reasons.push("Pincode bonus");
  }

  const skills = new Set([...tokens(engineer.skills), ...tokens(engineer.category)]);
  const wanted = new Set<string>();
  if (input.productType) {
    for (const skill of SKILL_BY_TYPE[input.productType.toUpperCase()] ?? [input.productType.toUpperCase()]) wanted.add(skill);
  }
  if ((input.companyCode ?? "").toUpperCase().includes("SOL")) wanted.add("SOLAR");
  else if (input.companyCode) wanted.add("PUMPS");
  if (input.callType === "BREAKDOWN") wanted.add("BREAKDOWN");
  if (input.callType === "INSTALLATION") wanted.add("INSTALLATION");
  if (input.callType === "INSURANCE") wanted.add("INSURANCE");
  if (input.callType === "MOBILE_APP") wanted.add("MOBILE");
  if (input.callType === "SCHEME") {
    wanted.add("SCHEME");
    wanted.add("MSEDCL");
    wanted.add("SOLAR");
  }
  if ([...wanted].some((skill) => skills.has(skill))) {
    score += 25;
    reasons.push("Skill match");
  }
  if (input.brandId && engineer.brandId === input.brandId) {
    score += 20;
    reasons.push("OEM brand");
  } else if (input.brandId && /SERVICE|CENTRE|CENTER|OEM/i.test(engineer.kind) && skills.has("OEM")) {
    score += 12;
    reasons.push("Service centre");
  }

  if (engineer.punchedIn) {
    score += 15;
    reasons.push("Punched in");
  }

  const cap = input.dailyCap ?? 8;
  if (openCount >= cap) {
    score -= 50;
    reasons.push(`Over the daily cap of ${cap}`);
  } else {
    score += Math.max(0, cap - openCount);
    reasons.push(`${openCount} open`);
  }

  const techLat = engineer.lastLat ?? engineer.homeLat;
  const techLng = engineer.lastLng ?? engineer.homeLng;
  if (input.lat != null && input.lng != null && techLat != null && techLng != null) {
    const km = distanceKm(input.lat, input.lng, techLat, techLng);
    const bonus = Math.max(0, Math.round(20 - km / 15));
    score += bonus;
    reasons.push(`${Math.round(km)} km`);
  }

  if (input.previousEngineerId && input.previousEngineerId === engineer.id) {
    score += 35;
    reasons.push("Previous technician");
  }
  if (senior) reasons.push("Third repeat: area manager");

  return blank(score, reasons.join(" · "));
}

export function rankEngineers(
  engineers: EngineerCandidate[],
  input: AssignmentInput,
  openCounts: Map<string, number>,
  closeRates: Map<string, number>,
) {
  return engineers
    .map((engineer) => scoreEngineer(engineer, input, openCounts.get(engineer.id) ?? 0, closeRates.get(engineer.id) ?? 0))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || b.closeRate - a.closeRate || a.openCount - b.openCount || a.name.localeCompare(b.name));
}
