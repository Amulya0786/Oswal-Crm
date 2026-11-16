import { normalizePhone } from "./mask";

export function personName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function placeKey(value?: string | null) {
  const text = (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return text || null;
}

export type CustomerCandidate = {
  id: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  extraPhones?: string[];
  pincode?: string | null;
  village?: string | null;
  mergedIntoId?: string | null;
};

export type CustomerMatch = { id: string; basis: "phone" | "alternate" | "name-place" };

/** One person: mobile first (including alternates), then name plus village or pincode. */
export function pickCustomer(
  candidates: CustomerCandidate[],
  input: { phone: string; name: string; pincode?: string | null; village?: string | null },
): CustomerMatch | null {
  const phone = normalizePhone(input.phone);
  const live = candidates.filter((row) => !row.mergedIntoId);
  const byPrimary = live.find((row) => normalizePhone(row.phone) === phone);
  if (byPrimary) return { id: byPrimary.id, basis: "phone" };
  const byAlt = live.find((row) => {
    if (row.altPhone && normalizePhone(row.altPhone) === phone) return true;
    return (row.extraPhones ?? []).some((item) => normalizePhone(item) === phone);
  });
  if (byAlt) return { id: byAlt.id, basis: "alternate" };

  const name = personName(input.name);
  const pin = placeKey(input.pincode);
  const village = placeKey(input.village);
  if (!name || (!pin && !village)) return null;
  const placeHits = live.filter((row) => {
    if (personName(row.name) !== name) return false;
    const samePin = Boolean(pin && placeKey(row.pincode) === pin);
    const sameVillage = Boolean(village && placeKey(row.village) === village);
    return samePin || sameVillage;
  });
  if (placeHits.length !== 1) return null;
  return { id: placeHits[0].id, basis: "name-place" };
}

export function assetKey(input: {
  serialNorm?: string | null;
  customerId: string;
  productId?: string | null;
  productName?: string | null;
  capacityLabel?: string | null;
}) {
  const serial = (input.serialNorm ?? "").trim().toUpperCase().replace(/[\s._,\-/]+/g, "");
  if (serial) return `serial:${serial}`;
  const product = (input.productId || input.productName || "unspecified").trim().toLowerCase();
  const capacity = (input.capacityLabel ?? "").trim().toLowerCase();
  return `install:${input.customerId}:${product}:${capacity}`;
}

export function repeatWindowDays(previousAt: Date, currentAt: Date): 30 | 60 | 90 | null {
  const days = (currentAt.getTime() - previousAt.getTime()) / 86400000;
  if (!Number.isFinite(days) || days < 0) return null;
  if (days <= 30) return 30;
  if (days <= 60) return 60;
  if (days <= 90) return 90;
  return null;
}

export function repeatPhrase(ticketNo: string | null | undefined, window: 30 | 60 | 90 | null) {
  if (!ticketNo) return null;
  const link = `repeat of ${ticketNo}`;
  return window ? `${link} · repeat failure within ${window} days` : link;
}

export function composeRepeatReason(duplicateOf: string | null | undefined, repeatOf: string | null | undefined, window: 30 | 60 | 90 | null) {
  const parts: string[] = [];
  if (duplicateOf) parts.push(`Duplicate of ${duplicateOf}`);
  const phrase = repeatPhrase(repeatOf, window);
  if (phrase) parts.push(phrase);
  return parts.length ? parts.join(" · ") : null;
}

export function coverStatus(input: { warrantyUntil?: Date | null; amcUntil?: Date | null }, now = new Date()) {
  const warranty = !input.warrantyUntil
    ? "Not recorded"
    : input.warrantyUntil.getTime() >= now.getTime()
      ? "In warranty"
      : "Warranty expired";
  const amc = !input.amcUntil ? "No AMC" : input.amcUntil.getTime() >= now.getTime() ? "AMC active" : "AMC expired";
  return { warranty, amc };
}

/** A closure is a first-time fix when this ticket is not itself a repeat failure and nothing on the asset reopens within 30 days. */
export function isFirstTimeFix(input: { repeatWindow: number | null; closedAt: Date | null; laterBookDates: Date[] }) {
  if (!input.closedAt) return null;
  if (input.repeatWindow != null) return false;
  const limit = input.closedAt.getTime() + 30 * 86400000;
  const reopened = input.laterBookDates.some((date) => date.getTime() > input.closedAt!.getTime() && date.getTime() <= limit);
  return !reopened;
}

export type AssetMove = {
  id: string;
  serialNorm?: string | null;
  productId?: string | null;
  productName?: string | null;
  capacityLabel?: string | null;
  identityKey: string;
};

export function retargetAssets(keepCustomerId: string, assets: AssetMove[], existingKeys: string[]) {
  const taken = new Set(existingKeys);
  const updates: { id: string; identityKey: string; foldIntoKey?: string }[] = [];
  for (const asset of assets) {
    const next = assetKey({
      serialNorm: asset.serialNorm,
      customerId: keepCustomerId,
      productId: asset.productId,
      productName: asset.productName,
      capacityLabel: asset.capacityLabel,
    });
    if (next !== asset.identityKey && taken.has(next)) updates.push({ id: asset.id, identityKey: next, foldIntoKey: next });
    else {
      taken.add(next);
      updates.push({ id: asset.id, identityKey: next });
    }
  }
  return updates;
}
