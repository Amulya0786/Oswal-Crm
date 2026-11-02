/** Keep a 10-digit mobile. A leading 91 or a single trunk 0 is removed. Any other length stays so the caller can reject it. */
export function normalizePhone(input: string | null | undefined) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function maskPhone(phone: string | null | undefined) {
  const last = normalizePhone(phone);
  if (last.length < 6) return "••••••";
  return `${last.slice(0, 2)}•••••${last.slice(-3)}`;
}

export function displayPhone(phone: string | null | undefined, mask: boolean) {
  if (!phone) return "—";
  return mask ? maskPhone(phone) : normalizePhone(phone);
}
