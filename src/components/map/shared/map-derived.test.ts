import { describe, expect, it } from "vitest";
import type { Spot } from "@/lib/types";
import {
  deriveMapSpotView,
  deriveMapScopeLabel,
  deriveScopeCitySpots,
  deriveSpotCityDisplayName,
  buildRenderedMapItems,
  deriveMapViewportPoints,
  deriveSpotCentroid,
  filterMapEventsByGeo,
  unionById,
} from "@/components/map/shared/map-derived";
import type { MapEvent } from "@/types/sport-events";

const spot = (
  id: string,
  citySlug: string,
  lat = Number(id),
  lon = Number(id),
) => ({
  id,
  citySlug,
  city: citySlug,
  types: [{ name: "Plaza" }],
  location: { lat, lon },
} as unknown as Spot);

describe("deriveScopeCitySpots", () => {
  const countrySpots = [
    spot("1", "bogota", 4.6, -74.06),
    spot("2", "medellin", 6.24, -75.58),
    spot("3", "bogota", 4.7, -74.05),
  ];

  it("derives citySpots from countrySpots when server omitted duplicate citySpots on the wire", () => {
    expect(
      deriveScopeCitySpots(countrySpots, [], "Bogota").map((s) => s.id),
    ).toEqual(["1", "3"]);
  });

  it("prefers explicit citySpots when countrySpots degraded to empty", () => {
    const fallbackCity = [spot("9", "bogota", 4.65, -74.08)];
    expect(deriveScopeCitySpots([], fallbackCity, "bogota")).toBe(fallbackCity);
  });

  it("returns empty array when no citySlug is selected and citySpots is empty", () => {
    expect(deriveScopeCitySpots(countrySpots, [], null)).toEqual([]);
  });
});

describe("buildRenderedMapItems", () => {
  it("retains cluster members so the cluster can expand on click", () => {
    const items = buildRenderedMapItems(
      [
        spot("1", "paris", 48.85, 2.35),
        spot("2", "paris", 48.86, 2.36),
        spot("3", "lyon", 45.76, 4.83),
      ],
      4,
      6,
    );
    const cluster = items.find((item) => item.kind === "cluster");

    expect(cluster?.kind).toBe("cluster");
    if (cluster?.kind === "cluster") {
      expect(cluster.spots.map((item) => item.id)).toEqual(["1", "2"]);
    }
  });

  it("clusters nearby spots even when their city slugs differ", () => {
    const items = buildRenderedMapItems(
      [
        spot("1", "city-a", 48.85, 2.35),
        spot("2", "city-b", 48.86, 2.36),
      ],
      4,
      6,
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("cluster");
  });

  it("does not cluster distant spots only because they share a city slug", () => {
    const items = buildRenderedMapItems(
      [
        spot("1", "same-city", 48.85, 2.35),
        spot("2", "same-city", 45.76, 4.83),
      ],
      4,
      6,
    );

    expect(items.every((item) => item.kind === "spot")).toBe(true);
  });

  it("slightly displaces co-located spots when unclustered to prevent click hijacking", () => {
    const items = buildRenderedMapItems(
      [
        spot("1", "brooklyn", 40.713, -74.001),
        spot("2", "brooklyn", 40.713, -74.001),
      ],
      12,
      6,
    );

    expect(items).toHaveLength(2);
    expect(items[0]?.kind).toBe("spot");
    expect(items[1]?.kind).toBe("spot");
    if (items[0]?.kind === "spot" && items[1]?.kind === "spot") {
      expect(items[0].spot.location).not.toEqual(items[1].spot.location);
    }
  });
});

describe("deriveMapSpotView", () => {
  it("filters by radius before returning nearest-first results", () => {
    const spots = [
      spot("far", "city", 40, 0),
      spot("near", "city", 0.1, 0),
      spot("middle", "city", 1, 0),
    ];

    expect(
      deriveMapSpotView(spots, { lat: 0, lon: 0 }, 80).spots.map(
        (item) => item.id,
      ),
    ).toEqual(["near", "middle"]);
  });

  it("returns reusable distance metadata for the visible spot view", () => {
    const spots = [
      spot("far", "city", 1, 0),
      spot("near", "city", 0.1, 0),
    ];
    const view = deriveMapSpotView(spots, { lat: 0, lon: 0 });

    expect(view.spots.map((item) => item.id)).toEqual(["near", "far"]);
    expect(view.distanceMilesById.get("near")).toBeCloseTo(6.9, 1);
    expect(view.distanceMilesById.get("far")).toBeCloseTo(69, 0);
  });
});

describe("deriveMapViewportPoints", () => {
  const event = { lat: 51.5, lon: -0.1 } as MapEvent;

  it("uses events instead of hidden spots for the events layer", () => {
    const points = deriveMapViewportPoints(
      [spot("1", "paris", 48.85, 2.35)],
      [event],
      new Set(["events"]),
    );

    expect(points).toEqual([[51.5, -0.1]]);
  });

  it("fits both visible layers when both are enabled", () => {
    const points = deriveMapViewportPoints(
      [spot("1", "paris", 48.85, 2.35)],
      [event],
      new Set(["spots", "events"]),
    );

    expect(points).toEqual([
      [48.85, 2.35],
      [51.5, -0.1],
    ]);
  });
});

describe("unionById", () => {
  const base = [
    spot("1", "paris", 48.85, 2.35),
    spot("2", "lyon", 45.76, 4.83),
  ];
  const extra = [
    spot("2", "lyon-fresh", 45.76, 4.83),
    spot("3", "medellin", 6.24, -75.58),
  ];

  it("keeps base order and appends only unseen entries", () => {
    expect(unionById(base, extra).map((item) => item.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("lets the extra list override a shared id in place", () => {
    expect(unionById(base, extra)[1]?.citySlug).toBe("lyon-fresh");
  });

  it("returns the base list untouched when the extra list is empty", () => {
    expect(unionById(base, [])).toBe(base);
  });
});

describe("filterMapEventsByGeo", () => {
  const regions = [
    { name: "Europe", countries: ["France", "Germany"] },
    { name: "North America", countries: ["United States"] },
  ] as const;
  const events = [
    { id: "fr", country: "France" },
    { id: "de", country: "Germany" },
    { id: "us", country: "United States" },
  ] as MapEvent[];

  it("filters events by region using the region catalog", () => {
    expect(
      filterMapEventsByGeo(events, regions, "Europe", null).map(
        (event) => event.id,
      ),
    ).toEqual(["fr", "de"]);
  });

  it("filters events by country using the same exact value as spots", () => {
    expect(
      filterMapEventsByGeo(events, regions, null, "Germany").map(
        (event) => event.id,
      ),
    ).toEqual(["de"]);
  });

  it("does not filter when no location filter is active", () => {
    expect(filterMapEventsByGeo(events, regions, null, null, null)).toBe(
      events,
    );
  });

  it("filters events by canonical citySlug when present", () => {
    const cityEvents = [
      { id: "par", country: "France", city: "Paris", citySlug: "paris" },
      { id: "lyo", country: "France", city: "Lyon", citySlug: "lyon" },
    ] as MapEvent[];

    expect(
      filterMapEventsByGeo(cityEvents, regions, null, "France", "lyon").map(
        (event) => event.id,
      ),
    ).toEqual(["lyo"]);
  });

  it("slugifies the event city when no canonical citySlug exists", () => {
    const cityEvents = [
      { id: "par", country: "France", city: "Paris" },
      { id: "lyo", country: "France", city: "Lyon" },
    ] as MapEvent[];

    expect(
      filterMapEventsByGeo(cityEvents, regions, null, "France", "lyon").map(
        (event) => event.id,
      ),
    ).toEqual(["lyo"]);
  });
});

describe("deriveSpotCentroid", () => {
  it("returns null for an empty list — no spots, no center, no radius scope", () => {
    expect(deriveSpotCentroid([])).toBeNull();
  });

  it("returns the spot itself for a single-spot list", () => {
    expect(deriveSpotCentroid([spot("1", "city", 4.71, -74.07)])).toEqual({
      lat: 4.71,
      lon: -74.07,
    });
  });

  it("returns the arithmetic mean of all spot coordinates", () => {
    const origin = deriveSpotCentroid([
      spot("1", "city", 4.0, -74.0),
      spot("2", "city", 5.0, -75.0),
      spot("3", "city", 6.0, -76.0),
    ]);

    expect(origin).toEqual({ lat: 5, lon: -75 });
  });
});

describe("deriveSpotCityDisplayName", () => {
  const spots = [
    { ...spot("1", "toledo"), country: "United States", city: "Toledo, Ohio" },
    { ...spot("2", "toledo"), country: "Spain", city: "Toledo" },
    { ...spot("3", "madrid"), country: "Spain", city: "Madrid" },
  ] as Spot[];

  it("resolves the display name from the matching country and citySlug", () => {
    expect(deriveSpotCityDisplayName(spots, "Spain", "toledo")).toBe("Toledo");
  });

  it("does not take a same-slug spot from another country", () => {
    expect(deriveSpotCityDisplayName(spots, "United States", "toledo")).toBe(
      "Toledo, Ohio",
    );
  });

  it("returns null for an unknown slug — never leaks the raw slug", () => {
    expect(deriveSpotCityDisplayName(spots, "Spain", "sevilla")).toBeNull();
  });

  it("returns null without a country or slug", () => {
    expect(deriveSpotCityDisplayName(spots, null, "toledo")).toBeNull();
    expect(deriveSpotCityDisplayName(spots, "Spain", null)).toBeNull();
  });
});

describe("deriveMapScopeLabel", () => {
  it("joins the city and country display names when both resolve", () => {
    expect(deriveMapScopeLabel("Barcelona", "Spain")).toBe(
      "Barcelona, Spain",
    );
  });

  it("falls back to the country alone when there is no city (scope=country)", () => {
    expect(deriveMapScopeLabel(null, "Spain")).toBe("Spain");
  });

  it("returns null without a resolved country", () => {
    expect(deriveMapScopeLabel("Barcelona", null)).toBeNull();
  });
});
