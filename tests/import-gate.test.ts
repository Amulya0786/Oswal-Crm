import { describe, expect, it } from "vitest";
import { importRequestWithoutSession } from "../src/middleware";

describe("import token bypass", () => {
  it("lets the import client through only on the import routes", () => {
    expect(importRequestWithoutSession("POST", "/api/desk/import/preview", true)).toBe(true);
    expect(importRequestWithoutSession("POST", "/api/desk/import/commit", true)).toBe(true);
    expect(importRequestWithoutSession("GET", "/api/desk/import/stats", true)).toBe(true);
    expect(importRequestWithoutSession("POST", "/api/desk/import/commit", false)).toBe(false);
    expect(importRequestWithoutSession("GET", "/api/desk/complaints", true)).toBe(false);
    expect(importRequestWithoutSession("POST", "/api/auth/login", true)).toBe(false);
  });
});
