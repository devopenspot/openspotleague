import { describe, expect, it } from "vitest";
import {
  isFilteredModeComplete,
  normalizeMapModeParams,
  readCountryScopeAll,
  requestedMapMode,
  resolveUrlRegionCountry,
  shouldCloseGateSearch,
  shouldEnforceFilteredGeoGate,
} from "@/components/map/shared/map-mode";

describe("map mode URL state", () => {
  it("gives saved mode precedence over nearby mode", () => {
    const normalized = normalizeMapModeParams(
      new URLSearchParams("saved=1&nearby=1&country=france"),
    );

    expect(normalized.toString()).toBe("saved=1&country=france");
    expect(requestedMapMode(normalized)).toBe("saved");
  });

  it("preserves unrelated parameters", () => {
    const normalized = normalizeMapModeParams(
      new URLSearchParams("nearby=1&region=europe&layer=spots,events"),
    );

    expect(normalized.toString()).toBe("nearby=1&region=europe&layer=spots%2Cevents");
    expect(requestedMapMode(normalized)).toBe("nearby");
  });

  it("defaults to filtered mode", () => {
    expect(requestedMapMode(new URLSearchParams("country=france"))).toBe("filtered");
  });

  it("enforces filtered completeness requires region, country and city", () => {
    expect(isFilteredModeComplete(null, null, null)).toBe(false);
    expect(isFilteredModeComplete(null, null, "bogota")).toBe(false);
    expect(isFilteredModeComplete("Europe", null, "paris")).toBe(false);
    expect(isFilteredModeComplete(null, "France", "paris")).toBe(false);
    expect(isFilteredModeComplete("Europe", "France", null)).toBe(false);
    expect(isFilteredModeComplete("Europe", "France", "paris")).toBe(true);
    // Explicit no-cities escape: country-wide scope satisfies the city rule.
    expect(isFilteredModeComplete("Europe", "France", null, true)).toBe(true);
  });

  it("gates filtered mode when region/country/city incomplete", () => {
    expect(shouldEnforceFilteredGeoGate("filtered", null, null, null)).toBe(true);
    expect(shouldEnforceFilteredGeoGate("filtered", "Europe", null, null)).toBe(true);
    expect(shouldEnforceFilteredGeoGate("filtered", null, "France", "paris")).toBe(true);
    expect(shouldEnforceFilteredGeoGate("filtered", "Europe", "France", null)).toBe(true);
    expect(shouldEnforceFilteredGeoGate("filtered", "Europe", "France", "paris")).toBe(false);
    // Escape marker satisfies the mandatory city when no cities exist.
    expect(
      shouldEnforceFilteredGeoGate("filtered", "Europe", "France", null, { countryScopeAll: true }),
    ).toBe(false);
    expect(shouldEnforceFilteredGeoGate("nearby", null, null, null)).toBe(false);
    expect(shouldEnforceFilteredGeoGate("saved", null, null, null)).toBe(false);
    expect(shouldEnforceFilteredGeoGate("filtered", null, null, null, { hasFocus: true })).toBe(false);
  });

  it("resolves region/country from URL with catalog", () => {
    const regions = [
      { name: "Europe", countries: ["France", "Germany"] },
      { name: "Asia", countries: ["Japan"] },
    ];
    expect(resolveUrlRegionCountry(new URLSearchParams("region=europe&country=france"), regions)).toEqual({
      region: "Europe",
      country: "France",
      city: null,
    });
    expect(
      resolveUrlRegionCountry(new URLSearchParams("region=europe&country=france&city=paris"), regions),
    ).toEqual({
      region: "Europe",
      country: "France",
      city: "paris",
    });
    expect(resolveUrlRegionCountry(new URLSearchParams("region=invalid&country=france"), regions)).toEqual({
      region: null,
      country: "France",
      city: null,
    });
    expect(resolveUrlRegionCountry(new URLSearchParams("region=europe"), regions)).toEqual({
      region: "Europe",
      country: null,
      city: null,
    });
    // City without a resolved country is meaningless and dropped.
    expect(
      resolveUrlRegionCountry(new URLSearchParams("city=paris"), regions),
    ).toEqual({
      region: null,
      country: null,
      city: null,
    });
    expect(resolveUrlRegionCountry(new URLSearchParams(""), regions)).toEqual({
      region: null,
      country: null,
      city: null,
    });
  });

  it("resolves degraded catalog leniently", () => {
    // empty regions but slugs present should still count as selection (shared-link fallback)
    expect(resolveUrlRegionCountry(new URLSearchParams("region=europe&country=france"), [])).toEqual({
      region: "europe",
      country: "france",
      city: null,
    });
    expect(
      resolveUrlRegionCountry(new URLSearchParams("region=europe&country=france&city=paris"), []),
    ).toEqual({
      region: "europe",
      country: "france",
      city: "paris",
    });
    expect(resolveUrlRegionCountry(new URLSearchParams("region=europe"), [])).toEqual({
      region: "europe",
      country: null,
      city: null,
    });
  });

  it("reads the country-wide escape marker", () => {
    expect(readCountryScopeAll(new URLSearchParams("scope=country"))).toBe(true);
    expect(readCountryScopeAll(new URLSearchParams("scope=city"))).toBe(false);
    expect(readCountryScopeAll(new URLSearchParams(""))).toBe(false);
  });
});

describe("shouldCloseGateSearch", () => {
  it("closes the forced overlay when the user exits the gate via a mode switch", () => {
    expect(shouldCloseGateSearch(true, false, "nearby")).toBe(true);
    expect(shouldCloseGateSearch(true, false, "saved")).toBe(true);
  });

  it("keeps the overlay open while the gate is still active", () => {
    expect(shouldCloseGateSearch(true, true, "filtered")).toBe(false);
  });

  it("never closes when the gate resolves inside filtered mode (overlay commit closes it itself)", () => {
    expect(shouldCloseGateSearch(true, false, "filtered")).toBe(false);
  });

  it("does nothing when the gate was never forced", () => {
    expect(shouldCloseGateSearch(false, false, "nearby")).toBe(false);
    expect(shouldCloseGateSearch(false, false, "saved")).toBe(false);
  });
});
