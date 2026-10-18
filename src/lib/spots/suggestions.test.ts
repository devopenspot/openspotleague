import { describe, expect, it } from "vitest";
import {
  buildSuggestedSpots,
  SUGGESTED_SPOTS_LIMIT,
} from "@/lib/spots/suggestions";
import type { Spot } from "@/lib/types";

function makeSpot(id: string, lat: number, lon: number): Spot {
  return {
    id,
    slug: id,
    name: id,
    city: "Test City",
    citySlug: "test-city",
    address: "1 Test St",
    types: [],
    sports: [],
    image: "",
    country: "Testland",
    countryCode: "TS",
    instagram: null,
    verificationCount: 0,
    visibility: "public",
    origin: "seed",
    communitySubmissionCount: 0,
    adminHidden: false,
    location: { lat, lon },
    createdBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

const CURRENT = makeSpot("current", 5, 5);
const NEAR = makeSpot("near", 0.5, 0.5);
const MID = makeSpot("mid", 2, 2);
const FAR = makeSpot("far", 10, 10);
const ALL = [CURRENT, FAR, MID, NEAR];

describe("buildSuggestedSpots", () => {
  it("ranks by distance from the user location when available", () => {
    const result = buildSuggestedSpots({
      current: CURRENT,
      all: ALL,
      origin: { lat: 0, lon: 0 },
    });
    expect(result.spots.map((s) => s.id)).toEqual(["near", "mid", "far"]);
    expect(result.scopeLabel).toBe("Nearest spots to you");
  });

  it("excludes the current spot", () => {
    const result = buildSuggestedSpots({
      current: CURRENT,
      all: ALL,
      origin: { lat: 0, lon: 0 },
    });
    expect(result.spots.some((s) => s.id === CURRENT.id)).toBe(false);
  });

  it("falls back to the current spot's location when origin is null", () => {
    const result = buildSuggestedSpots({
      current: CURRENT,
      all: ALL,
      origin: null,
    });
    // From (5,5) the nearest is "mid", not "near" — proves the origin is the
    // current spot's coordinates rather than the map's (0,0).
    expect(result.spots.map((s) => s.id)).toEqual(["mid", "near", "far"]);
    expect(result.scopeLabel).toBe("Nearest spots to current");
  });

  it("drops spots with non-finite coordinates", () => {
    const broken = { ...makeSpot("broken", 1, 1), location: { lat: NaN, lon: 1 } };
    const result = buildSuggestedSpots({
      current: CURRENT,
      all: [...ALL, broken],
      origin: null,
    });
    expect(result.spots.some((s) => s.id === "broken")).toBe(false);
  });

  it("returns empty when both origins are unavailable", () => {
    const result = buildSuggestedSpots({
      current: {
        ...CURRENT,
        location: { lat: NaN, lon: NaN },
      },
      all: ALL,
      origin: null,
    });
    expect(result.spots).toEqual([]);
    expect(result.scopeLabel).toBe("");
  });

  it("caps the result at the limit", () => {
    const many = Array.from({ length: SUGGESTED_SPOTS_LIMIT + 4 }, (_, i) =>
      makeSpot(`spot-${i}`, i + 1, i + 1),
    );
    const result = buildSuggestedSpots({
      current: CURRENT,
      all: many,
      origin: null,
    });
    expect(result.spots).toHaveLength(SUGGESTED_SPOTS_LIMIT);
  });
});
