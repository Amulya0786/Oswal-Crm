import { Prisma } from "@prisma/client";

/** Placeholder customer names. The list filter and the health count use the same set. */
export const REVIEW_NAMES = [
  "abc",
  "test",
  "asdf",
  "asdfg",
  "asdfgh",
  "xxx",
  "xxxx",
  "aaa",
  "aaaa",
  "dummy",
  "unknown",
  "n/a",
  "na",
  "nil",
  "none",
  "sample",
  "tbd",
  "customer",
  "name",
  "test test",
] as const;

export function nameNeedsReview(name: string | null | undefined) {
  const trimmed = (name ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return false;
  if (trimmed.includes("?")) return true;
  return (REVIEW_NAMES as readonly string[]).includes(trimmed.toLowerCase());
}

export function nameReviewSql(column: Prisma.Sql = Prisma.raw(`"customerName"`)) {
  return Prisma.sql`(
    lower(btrim(${column})) IN (${Prisma.join([...REVIEW_NAMES])})
    OR position('?' in ${column}) > 0
  )`;
}
