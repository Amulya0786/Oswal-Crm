import { nameNeedsReview } from "@/lib/names";

export function NameReviewChip({ name }: { name: string | null | undefined }) {
  if (!nameNeedsReview(name)) return null;
  return <span className="stamp amber name-review">Name needs review</span>;
}
