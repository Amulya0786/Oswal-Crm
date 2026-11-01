export function formatTicket(seq: number) {
  return `OPL${String(seq).padStart(5, "0")}`;
}

export function nextTicketSeq(last: number | null | undefined) {
  if (!last || last < 10000) return 10001;
  return last + 1;
}

export function nextTicketNumber(lastTicket: string | null | undefined) {
  if (!lastTicket) return formatTicket(10001);
  const n = Number(lastTicket.replace(/\D/g, ""));
  if (!Number.isFinite(n) || n < 1) return formatTicket(10001);
  return formatTicket(n + 1);
}
