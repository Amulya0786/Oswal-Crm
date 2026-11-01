export function normalizePhone(input: string | null | undefined) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
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
