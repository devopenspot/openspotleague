import { afterEach, describe, expect, it } from "vitest";

// The happy-dom global stubs localStorage per test run; key ops are
// exercised through the module under test.
import {
  applyLastMapFilter,
  clearLastMapFilter,
  getLastMapFilter,
  lastFilterResolvesGate,
  resolveMapEntryHref,
  setLastMapFilter,
} from "./last-filter";
import { setMapPreserveLocation, clearMapPreserveLocation } from "./preserve";
import type { Region } from "@/lib/types";

const regions: Region[] = [
  {
    name: "Europe",
    desc: "Europe spots",
    count: "1.0k Spots",
    image: "",
    link: "/map?region=europe",
    countries: ["France", "Germany"],
  },
];

function seedRaw(value: unknown): void {
  window.localStorage.setItem("openspot-last-map-filter", JSON.stringify(value));
}

describe("last-filter persistence", () => {
  it("round-trips region, country and picked city", () => {
    setLastMapFilter("Europe", "France", "paris");
    const last = getLastMapFilter();
    expect(last?.region).toBe("Europe");
    expect(last?.country).toBe("France");
    expect(last?.regionSlug).toBe("europe");
    expect(last?.countrySlug).toBe("france");
    expect(last?.city).toBe("paris");
    expect(last?.citySlug).toBe("paris");
    expect(last?.countryScopeAll ?? false).toBe(false);
  });

  it("drops a stored city when the next commit omits it", () => {
    setLastMapFilter("Europe", "France", "paris");
    setLastMapFilter("Europe", "France", null);
    const last = getLastMapFilter();
    expect(last?.citySlug ?? "").toBe("");
    expect(last?.countryScopeAll ?? false).toBe(false);
  });

  it("stores the no-cities country-wide escape", () => {
    setLastMapFilter("Europe", "France", null, true);
    const last = getLastMapFilter();
    expect(last?.countryScopeAll ?? false).toBe(true);
    expect(last?.citySlug ?? "").toBe("");
    expect(lastFilterResolvesGate(last, regions)).toBe(true);
  });

  it("rejects payloads whose slugs no longer match the catalog", () => {
    seedRaw({
      region: "Nowhere",
      country: "Atlantis",
      regionSlug: "nowhere",
      countrySlug: "atlantis",
      updatedAt: 1,
    });
    const last = getLastMapFilter();
    expect(last).not.toBeNull();
    expect(lastFilterResolvesGate(last, regions)).toBe(false);
  });

  it("reads legacy payloads without city fields as valid-but-city-less", () => {
    seedRaw({
      region: "Europe",
      country: "France",
      regionSlug: "europe",
      countrySlug: "france",
      updatedAt: 1,
    });
    const last = getLastMapFilter();
    expect(last?.region).toBe("Europe");
    // Legacy payload restores region+country; gate NOT resolved (one forced city pick).
    expect(lastFilterResolvesGate(last, regions)).toBe(false);
  });

  it("rejects invalid records and returns null", () => {
    seedRaw({ region: "Europe" });
    expect(getLastMapFilter()).toBeNull();
    seedRaw("not-a-record");
    expect(getLastMapFilter()).toBeNull();
  });

  it("clears the stored filter", () => {
    setLastMapFilter("Europe", "France", "paris");
    expect(getLastMapFilter()).not.toBeNull();
    clearLastMapFilter();
    expect(getLastMapFilter()).toBeNull();
  });
});

describe("last-filter gate resolution", () => {
  it("null filter never resolves the gate", () => {
    expect(lastFilterResolvesGate(null, regions)).toBe(false);
  });

  it("requires both region and country to resolve", () => {
    seedRaw({
      region: "Europe",
      country: "France",
      regionSlug: "europe",
      countrySlug: "france",
      city: "paris",
      citySlug: "paris",
      updatedAt: 1,
    });
    expect(lastFilterResolvesGate(getLastMapFilter(), regions)).toBe(true);
    seedRaw({
      region: "Europe",
      country: "France",
      regionSlug: "europe",
      countrySlug: "france",
      countryScopeAll: true,
      updatedAt: 1,
    });
    expect(lastFilterResolvesGate(getLastMapFilter(), regions)).toBe(true);
  });
});

describe("applyLastMapFilter", () => {
  const base = {
    region: "Europe",
    country: "France",
    regionSlug: "europe",
    countrySlug: "france",
    updatedAt: 1,
  };

  it("adds region, country and city, dropping nearby/saved modes", () => {
    const next = applyLastMapFilter(
      new URLSearchParams("nearby=1&saved=1&layer=sat"),
      { ...base, city: "paris", citySlug: "paris" },
    );
    expect(next.get("region")).toBe("europe");
    expect(next.get("country")).toBe("france");
    expect(next.get("city")).toBe("paris");
    expect(next.has("nearby")).toBe(false);
    expect(next.has("saved")).toBe(false);
    expect(next.get("layer")).toBe("sat");
  });

  it("maps the country-wide escape to scope=country", () => {
    const next = applyLastMapFilter(new URLSearchParams(), {
      ...base,
      countryScopeAll: true,
    });
    expect(next.get("scope")).toBe("country");
    expect(next.has("city")).toBe(false);
  });

  it("does not mutate the input params", () => {
    const input = new URLSearchParams("nearby=1");
    applyLastMapFilter(input, base);
    expect(input.toString()).toBe("nearby=1");
  });
});

describe("resolveMapEntryHref", () => {
  afterEach(() => {
    clearLastMapFilter();
    clearMapPreserveLocation();
  });

  it("falls back to /map without a stored filter", () => {
    clearLastMapFilter();
    expect(resolveMapEntryHref(regions)).toBe("/map");
  });

  it("falls back to /map before the catalog hydrates", () => {
    setLastMapFilter("Europe", "France", "paris");
    expect(resolveMapEntryHref([])).toBe("/map");
  });

  it("falls back to /map for a filter the catalog no longer has", () => {
    seedRaw({
      region: "Nowhere",
      country: "Atlantis",
      regionSlug: "nowhere",
      countrySlug: "atlantis",
      updatedAt: 1,
    });
    expect(resolveMapEntryHref(regions)).toBe("/map");
  });

  it("falls back to /map while a preserve flag is pending", () => {
    setLastMapFilter("Europe", "France", "paris");
    setMapPreserveLocation();
    expect(resolveMapEntryHref(regions)).toBe("/map");
  });

  it("resolves a complete filter with a city", () => {
    setLastMapFilter("Europe", "France", "paris");
    expect(resolveMapEntryHref(regions)).toBe(
      "/map?region=europe&country=france&city=paris",
    );
  });

  it("resolves the country-wide escape", () => {
    setLastMapFilter("Europe", "France", null, true);
    expect(resolveMapEntryHref(regions)).toBe(
      "/map?region=europe&country=france&scope=country",
    );
  });

  it("restores region+country only for a city-less legacy filter", () => {
    setLastMapFilter("Europe", "France");
    expect(resolveMapEntryHref(regions)).toBe(
      "/map?region=europe&country=france",
    );
  });
});
