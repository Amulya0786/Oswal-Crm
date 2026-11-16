import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashReportKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function issueReportKey() {
  const secret = randomBytes(24).toString("base64url");
  const key = `osk_${secret}`;
  return { key, hash: hashReportKey(key), prefix: key.slice(0, 8) };
}

export function reportKeyAccepted(presented: string, hashes: string[]) {
  const hashed = hashReportKey(presented);
  return hashes.some((stored) => {
    const left = Buffer.from(hashed);
    const right = Buffer.from(stored);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}

export function issueTrackToken() {
  return randomBytes(18).toString("base64url");
}
