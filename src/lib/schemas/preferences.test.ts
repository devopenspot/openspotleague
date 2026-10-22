import { describe, expect, it } from "vitest";
import { preferencesSchema, updatePreferencesSchema } from "./preferences";

describe("preferences schema", () => {
  it("supports distance, temperature, and one sport", () => {
    expect(preferencesSchema.parse({
      distanceUnit: "km",
      temperatureUnit: "F",
      disciplineSlug: "bmx",
    })).toEqual({
      distanceUnit: "km",
      temperatureUnit: "F",
      disciplineSlug: "bmx",
    });
  });

  it("supports 'all' for disciplineSlug to represent all disciplines", () => {
    expect(preferencesSchema.parse({
      distanceUnit: "mi",
      temperatureUnit: "C",
      disciplineSlug: "all",
    })).toEqual({
      distanceUnit: "mi",
      temperatureUnit: "C",
      disciplineSlug: "all",
    });

    expect(updatePreferencesSchema.safeParse({ disciplineSlug: "all" }).success).toBe(true);
  });

  it("rejects the removed grade field and multi-sport values", () => {
    expect(updatePreferencesSchema.safeParse({ grade: 2 }).success).toBe(false);
    expect(updatePreferencesSchema.safeParse({ disciplineSlug: ["bmx", "roller"] }).success).toBe(false);
  });
});
