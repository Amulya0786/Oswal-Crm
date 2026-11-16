export const ARCHIVE_MONTHS = 12;

export const ARCHIVE_STATUSES = ["CLOSED", "CLOSED_UNVERIFIED", "HAPPY_CALLING", "CANCELLED"] as const;

export function archiveCutoff(now = new Date()) {
  const cut = new Date(now.getTime());
  cut.setMonth(cut.getMonth() - ARCHIVE_MONTHS);
  return cut;
}

/** A ticket leaves the default lists once it has been closed for a year. */
export function shouldArchive(status: string, closedAt: Date | null, cancelledAt: Date | null, now = new Date()) {
  if (!ARCHIVE_STATUSES.includes(status as (typeof ARCHIVE_STATUSES)[number])) return false;
  const when = closedAt ?? cancelledAt;
  if (!when) return false;
  return when.getTime() < archiveCutoff(now).getTime();
}
