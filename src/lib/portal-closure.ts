import { haversineKm } from "@/lib/phase3";
import { isPortalTicket } from "@/lib/portal";

const LIMIT_M = 100;

export type PortalClosureInput = {
  portal: string | null | undefined;
  /** Desk and office closes cannot finish a portal ticket. */
  channel: "desk" | "field";
  photos: number;
  otpVerified: boolean;
  lat?: number | null;
  lng?: number | null;
  siteLat?: number | null;
  siteLng?: number | null;
};

export type PortalClosureDecision =
  | { kind: "standard" }
  | { kind: "close"; distanceM: number | null; siteUnpinned: boolean }
  | { kind: "pending"; reason: string };

export function decidePortalClosure(input: PortalClosureInput): PortalClosureDecision {
  if (!isPortalTicket(input.portal)) return { kind: "standard" };
  if (input.channel !== "field") {
    return { kind: "pending", reason: "Office close is waiting for site proof: a photo, GPS within 100 m, and the farmer OTP." };
  }
  const missing: string[] = [];
  if (input.photos < 1) missing.push("a site photo");
  if (!input.otpVerified) missing.push("the farmer OTP");
  const hasGps = input.lat != null && input.lng != null && Number.isFinite(input.lat) && Number.isFinite(input.lng);
  if (!hasGps) missing.push("a GPS reading");
  if (missing.length) {
    return { kind: "pending", reason: `Closure is waiting for ${missing.join(", ")}.` };
  }
  const siteKnown = input.siteLat != null && input.siteLng != null && Number.isFinite(input.siteLat) && Number.isFinite(input.siteLng);
  if (!siteKnown) {
    return { kind: "close", distanceM: null, siteUnpinned: true };
  }
  const distanceM = Math.round(haversineKm(
    { lat: input.lat as number, lng: input.lng as number },
    { lat: input.siteLat as number, lng: input.siteLng as number },
  ) * 1000);
  if (distanceM > LIMIT_M) {
    return { kind: "pending", reason: `GPS is ${distanceM} m from the site. Portal closure needs 100 m or less.` };
  }
  return { kind: "close", distanceM, siteUnpinned: false };
}
