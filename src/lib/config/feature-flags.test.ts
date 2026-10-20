import { afterEach, describe, expect, it } from "vitest";
import { isShortLinksEnabled } from "./feature-flags";

describe("isShortLinksEnabled", () => {
  const originalEnv = process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS;
    } else {
      process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = originalEnv;
    }
  });

  it("returns true when value is 'on', 'true', or '1' (case-insensitive and trimmed)", () => {
    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "on";
    expect(isShortLinksEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = " ON ";
    expect(isShortLinksEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "true";
    expect(isShortLinksEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "1";
    expect(isShortLinksEnabled()).toBe(true);
  });

  it("returns false when value is 'off', 'false', empty, or unset", () => {
    delete process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS;
    expect(isShortLinksEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "";
    expect(isShortLinksEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "off";
    expect(isShortLinksEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "false";
    expect(isShortLinksEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS = "disabled";
    expect(isShortLinksEnabled()).toBe(false);
  });
});
