import { describe, expect, it } from "vitest";
import {
  assertValidEventDateRange,
  isValidCalendarDate,
  normalizeCitySlug,
} from "./validation";

describe("sport event validation", () => {
  it("accepts real calendar dates and rejects normalized invalid dates", () => {
    expect(isValidCalendarDate("2026-02-28")).toBe(true);
    expect(isValidCalendarDate("2026-02-29")).toBe(false);
    expect(isValidCalendarDate("2026-2-28")).toBe(false);
  });

  it("requires the end date to be on or after the start date", () => {
    expect(() =>
      assertValidEventDateRange("2026-08-16", "2026-08-14"),
    ).toThrow("Event end date must be on or after the start date");
    expect(() =>
      assertValidEventDateRange("2026-08-14", "2026-08-16"),
    ).not.toThrow();
  });

  it("normalizes city names to stable slugs", () => {
    expect(normalizeCitySlug("São Paulo / Downtown")).toBe(
      "sao-paulo-downtown",
    );
  });
});
