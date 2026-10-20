import { describe, expect, it } from "vitest";
import {
  BASE62_ALPHABET,
  generateShortCode,
  isValidShortCode,
  normalizeTargetUrl,
  ShortLinkValidationError,
} from "./short-code";

describe("generateShortCode", () => {
  it("generates a 7-character string by default", () => {
    const code = generateShortCode();
    expect(code).toHaveLength(7);
    expect(isValidShortCode(code)).toBe(true);
  });

  it("supports lengths between 4 and 16", () => {
    for (const len of [4, 6, 8, 12, 16]) {
      const code = generateShortCode(len);
      expect(code).toHaveLength(len);
      expect(isValidShortCode(code)).toBe(true);
    }
  });

  it("throws when length is below 4 or above 16", () => {
    expect(() => generateShortCode(3)).toThrow(ShortLinkValidationError);
    expect(() => generateShortCode(17)).toThrow(ShortLinkValidationError);
  });

  it("contains only allowed Base62 characters", () => {
    const alphabetSet = new Set(BASE62_ALPHABET);
    for (let i = 0; i < 50; i++) {
      const code = generateShortCode(7);
      for (const char of code) {
        expect(alphabetSet.has(char)).toBe(true);
      }
    }
  });

  it("generates unique codes with high entropy", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const code = generateShortCode(7);
      expect(seen.has(code)).toBe(false);
      seen.add(code);
    }
  });
});

describe("isValidShortCode", () => {
  it("validates 4-16 alphanumeric strings", () => {
    expect(isValidShortCode("7xK9q2A")).toBe(true);
    expect(isValidShortCode("abcd")).toBe(true);
    expect(isValidShortCode("1234567890123456")).toBe(true);
  });

  it("rejects strings that are too short or too long", () => {
    expect(isValidShortCode("abc")).toBe(false);
    expect(isValidShortCode("12345678901234567")).toBe(false);
  });

  it("rejects non-alphanumeric characters", () => {
    expect(isValidShortCode("7xK9-q2A")).toBe(false);
    expect(isValidShortCode("7xK9_q2A")).toBe(false);
    expect(isValidShortCode("7xK9.q2A")).toBe(false);
    expect(isValidShortCode("7xK9/q2A")).toBe(false);
    expect(isValidShortCode("7xK9 q2A")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isValidShortCode(null)).toBe(false);
    expect(isValidShortCode(undefined)).toBe(false);
    expect(isValidShortCode(1234567)).toBe(false);
    expect(isValidShortCode({})).toBe(false);
  });
});

describe("normalizeTargetUrl", () => {
  it("normalizes relative paths and strips trailing slash", () => {
    expect(normalizeTargetUrl("/spots/spot-1/")).toBe("/spots/spot-1");
    expect(normalizeTargetUrl("/spots/spot-1")).toBe("/spots/spot-1");
    expect(normalizeTargetUrl("/")).toBe("/");
  });

  it("strips application origins to canonical relative paths", () => {
    expect(normalizeTargetUrl("https://openspotleague.com/spots/spot-123")).toBe("/spots/spot-123");
    expect(normalizeTargetUrl("http://localhost:3000/tv?play=clip-1")).toBe("/tv?play=clip-1");
    expect(normalizeTargetUrl("https://preview.vercel.app/games/join/crew42")).toBe("/games/join/crew42");
    expect(normalizeTargetUrl("https://custom.app/spots/1", "https://custom.app")).toBe("/spots/1");
  });

  it("sorts query parameters canonically", () => {
    expect(normalizeTargetUrl("/map?zoom=15&spot=abc")).toBe("/map?spot=abc&zoom=15");
    expect(normalizeTargetUrl("/spots?c=3&b=2&a=1")).toBe("/spots?a=1&b=2&c=3");
    expect(normalizeTargetUrl("/spots?")).toBe("/spots");
  });

  it("preserves URL hashes", () => {
    expect(normalizeTargetUrl("/spots/spot-1#weather")).toBe("/spots/spot-1#weather");
    expect(normalizeTargetUrl("/map?zoom=14&spot=1#legend")).toBe("/map?spot=1&zoom=14#legend");
  });

  it("rejects external domains", () => {
    expect(() => normalizeTargetUrl("https://malicious.example.com/steal")).toThrow(
      ShortLinkValidationError,
    );
    expect(() => normalizeTargetUrl("https://google.com")).toThrow(ShortLinkValidationError);
  });

  it("rejects recursive short links (/s/* and /s)", () => {
    expect(() => normalizeTargetUrl("/s/7xK9q2A")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/s")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/s/")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("https://openspotleague.com/s/nested")).toThrow(
      ShortLinkValidationError,
    );
  });

  it("rejects internal and infrastructure routes", () => {
    expect(() => normalizeTargetUrl("/api/spots")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/api/short-links")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/_next/static/chunk.js")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/admin/users")).toThrow(ShortLinkValidationError);
  });

  it("rejects protocol-relative and dangerous schemes", () => {
    expect(() => normalizeTargetUrl("//evil.com/phish")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("javascript:alert(1)")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("data:text/html,bad")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("file:///etc/passwd")).toThrow(ShortLinkValidationError);
  });

  it("rejects control characters and empty inputs", () => {
    expect(() => normalizeTargetUrl("")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("   ")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/spots/1\n/bad")).toThrow(ShortLinkValidationError);
    expect(() => normalizeTargetUrl("/spots/1\u0000")).toThrow(ShortLinkValidationError);
  });
});
