import { describe, expect, it } from "vitest";
import { SpotPatchSchema, SpotQuerySchema } from "./spot";

describe("SpotPatchSchema", () => {
  it("rejects non-HTTP Instagram URLs", () => {
    expect(
      SpotPatchSchema.safeParse({ instagram: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});

describe("SpotQuerySchema", () => {
  it("accepts an optional boolean hasImage flag", () => {
    expect(SpotQuerySchema.safeParse({ hasImage: true }).success).toBe(true);
    expect(SpotQuerySchema.safeParse({ hasImage: false }).success).toBe(true);
    expect(SpotQuerySchema.safeParse({ hasImage: "true" }).success).toBe(false);
    expect(SpotQuerySchema.safeParse({}).success).toBe(true);
  });
});
