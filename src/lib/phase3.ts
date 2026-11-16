export type ProofPolicy = {
  requirePhoto: boolean;
  requireIdentity: boolean;
  requireGps: boolean;
  maxKm: number;
};

export const DEFAULT_PROOF: ProofPolicy = {
  requirePhoto: true,
  requireIdentity: true,
  requireGps: true,
  maxKm: 15,
};

export type ProofInput = {
  photos: number;
  signature: boolean;
  otp: boolean;
  lat?: number | null;
  lng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
};

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Site photo, signature or OTP, and a GPS point. Distance is flagged only when both points exist. */
export function validateProof(input: ProofInput, policy: ProofPolicy = DEFAULT_PROOF) {
  const missing: string[] = [];
  if (policy.requirePhoto && input.photos < 1) missing.push("site photo");
  if (policy.requireIdentity && !input.signature && !input.otp) missing.push("signature or OTP");
  const hasGps = input.lat != null && input.lng != null;
  if (policy.requireGps && !hasGps) missing.push("GPS");
  let distanceKm: number | null = null;
  let gpsFar = false;
  if (hasGps && input.customerLat != null && input.customerLng != null) {
    distanceKm = Math.round(haversineKm({ lat: input.lat!, lng: input.lng! }, { lat: input.customerLat, lng: input.customerLng }) * 10) / 10;
    gpsFar = distanceKm > policy.maxKm;
  }
  return { ok: missing.length === 0, missing, distanceKm, gpsFar };
}

export function parseRating(text: string): { rating: number; comment: string } | null {
  const match = text.trim().match(/^([1-5])(?:\s*[-:.]?\s*(.*))?$/);
  if (!match) return null;
  return { rating: Number(match[1]), comment: (match[2] ?? "").trim() };
}

export function ratingNeedsEscalation(rating: number) {
  return rating <= 2;
}

export type ScoreWeights = {
  closures: number;
  tat: number;
  repeat: number;
  feedback: number;
  proof: number;
  reopen: number;
};

export const DEFAULT_WEIGHTS: ScoreWeights = {
  closures: 25,
  tat: 20,
  repeat: 20,
  feedback: 15,
  proof: 10,
  reopen: 10,
};

export type ScoreInput = {
  closures: number;
  assigned: number;
  tatHours: number | null;
  slaHours: number;
  repeats: number;
  feedback: number | null;
  proofOk: number;
  closed: number;
  reopened: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function performanceScore(input: ScoreInput, weights: ScoreWeights = DEFAULT_WEIGHTS) {
  const closureRate = input.assigned ? clamp((input.closures / input.assigned) * 100) : 0;
  const tat = input.tatHours == null || input.slaHours <= 0 ? 100 : clamp(100 - Math.max(0, input.tatHours / input.slaHours - 1) * 100);
  const repeat = input.closures ? clamp(100 - (input.repeats / input.closures) * 100) : 100;
  const feedback = input.feedback == null ? 0 : clamp((input.feedback / 5) * 100);
  const proof = input.closed ? clamp((input.proofOk / input.closed) * 100) : 0;
  const reopen = input.closed ? clamp(100 - (input.reopened / input.closed) * 100) : 100;
  const parts = { closureRate, tat, repeat, feedback, proof, reopen };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const score = Math.round(
    (closureRate * weights.closures + tat * weights.tat + repeat * weights.repeat + feedback * weights.feedback + proof * weights.proof + reopen * weights.reopen) / totalWeight,
  );
  return { score, parts };
}

export type IncentiveSlab = { min: number; amount: number };

export const DEFAULT_SLABS: IncentiveSlab[] = [
  { min: 90, amount: 2000 },
  { min: 75, amount: 1000 },
  { min: 60, amount: 500 },
  { min: 0, amount: 0 },
];

export function incentiveFor(score: number, slabs: IncentiveSlab[] = DEFAULT_SLABS) {
  const ordered = [...slabs].sort((a, b) => b.min - a.min);
  return ordered.find((slab) => score >= slab.min)?.amount ?? 0;
}

export type BookingHint = {
  category: string;
  fault: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  duplicate: boolean;
  note: string;
};

const HINTS: { test: RegExp; hint: BookingHint }[] = [
  { test: /controller|कंट्रोलर|rms/i, hint: { category: "Controller", fault: "Controller not starting", priority: "HIGH", duplicate: false, note: "Controller language in the description." } },
  { test: /panel|पैनल|module|इनवर्टर|inverter/i, hint: { category: "Solar panel", fault: "Low generation", priority: "NORMAL", duplicate: false, note: "Panel or inverter language." } },
  { test: /pump|पंप|पानी|water|leak/i, hint: { category: "Pump", fault: "No discharge", priority: "HIGH", duplicate: false, note: "Pump or water language." } },
];

export function suggestBooking(description: string, priorOpen: boolean): BookingHint {
  const found = HINTS.find((item) => item.test.test(description));
  const base = found?.hint ?? { category: "Pump", fault: "Not stated", priority: "NORMAL" as const, duplicate: false, note: "No strong keyword. Left as a normal pump call." };
  const again = /again|repeat|same|फिर|दोबारा/i.test(description) || priorOpen;
  return { ...base, duplicate: again, note: again ? `${base.note} This reads like a repeat.` : base.note };
}

export function suggestFixes(problem: string, history: { problem: string; solution: string }[]) {
  const needle = problem.toLowerCase();
  const hits = history.filter((row) => needle && (row.problem.toLowerCase().includes(needle) || needle.includes(row.problem.toLowerCase().slice(0, 12)))).slice(0, 3);
  if (!hits.length) return ["No similar closed complaint is on file yet. Record the actual problem and the fix."];
  return hits.map((row) => `${row.problem}: ${row.solution}`);
}

export function summariseTimeline(lines: string[]) {
  if (!lines.length) return "No events yet.";
  const head = lines.slice(0, 3).join(" ");
  return lines.length <= 3 ? head : `${head} … ${lines.length} events in all.`;
}

export function breachRisk(input: { ageHours: number; slaHours: number; repeat: boolean }) {
  const ratio = input.slaHours ? input.ageHours / input.slaHours : 0;
  if (ratio >= 1) return { risk: true, reason: "Already past the SLA." };
  if (ratio >= 0.75 || input.repeat) return { risk: true, reason: input.repeat ? "Repeat failure and the SLA window is closing." : "More than three quarters of the SLA has passed." };
  return { risk: false, reason: "Inside the SLA window." };
}

export function parseQuestion(text: string) {
  const older = text.match(/older than\s+(\d+)\s+day/i);
  const district = text.match(/\b(?:in|at)\s+([A-Za-z]+)/i);
  const product = text.match(/controller|panel|inverter|pump|motor|solar/i);
  const pending = /pending|open|live|unassigned|लंबित/i.test(text);
  return {
    pending,
    days: older ? Number(older[1]) : null,
    district: district ? district[1].replace(/\s+older$/i, "").trim() : null,
    product: product ? product[0].toLowerCase() : null,
  };
}

export type AiMode = "live" | "mock";

export function aiMode(key?: string | null): AiMode {
  return key ? "live" : "mock";
}
