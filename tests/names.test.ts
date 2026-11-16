import { describe, expect, it } from "vitest";
import { nameNeedsReview } from "../src/lib/names";

describe("placeholder customer names", () => {
  it("flags junk names and keeps a real name", () => {
    expect(nameNeedsReview("ABC")).toBe(true);
    expect(nameNeedsReview("  test ")).toBe(true);
    expect(nameNeedsReview("asdf")).toBe(true);
    expect(nameNeedsReview("Ramesh?")).toBe(true);
    expect(nameNeedsReview("NARAYAN VISHNU JADHAV")).toBe(false);
    expect(nameNeedsReview("")).toBe(false);
  });
});
