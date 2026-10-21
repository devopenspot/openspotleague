import { describe, expect, it } from "vitest";
import { buildBackToMapUrl, buildBackToMapUrlFromParams } from "./back-to-map";
import type { Region, Spot } from "@/lib/types";

function createMockSpot(overrides: Partial<Spot> = {}): Spot {
  return {
    id: "spot-123",
    slug: "brooklyn-banks",
    name: "Brooklyn Banks",
    city: "New York",
    citySlug: "new-york",
    address: "New York, NY",
    country: "United States",
    countryCode: "US",
    types: [{ slug: "plaza", name: "Plaza" }],
    sports: ["Skateboard"],
    image: "",
    instagram: null,
    verificationCount: 5,
    visibility: "public",
    origin: "community",
    communitySubmissionCount: 1,
    adminHidden: false,
    createdBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    location: { lat: 40.713, lon: -74.001 },
    ...overrides,
  };
}

const mockRegions: Region[] = [
  {
    name: "North America",
    desc: "North American skate spots",
    count: "150 spots",
    image: "/images/na.jpg",
    link: "/regions/north-america",
    countries: ["United States", "Canada"],
  },
];

describe("buildBackToMapUrl", () => {
  it("includes country, city, region, and spot id in deep link", () => {
    const spot = createMockSpot();
    const url = buildBackToMapUrl(spot, mockRegions);

    expect(url).toBe(
      "/map?country=united-states&city=new-york&region=north-america&spot=spot-123",
    );
  });

  it("handles spots without region data", () => {
    const spot = createMockSpot();
    const url = buildBackToMapUrl(spot);

    expect(url).toBe("/map?country=united-states&city=new-york&spot=spot-123");
  });

  it("handles spots without citySlug", () => {
    const spot = createMockSpot({ citySlug: "" });
    const url = buildBackToMapUrl(spot, mockRegions);

    expect(url).toBe(
      "/map?country=united-states&region=north-america&spot=spot-123",
    );
  });

  it("deprecated buildBackToMapUrlFromParams delegates to buildBackToMapUrl", () => {
    const spot = createMockSpot();
    const dummyParams = { get: () => null };
    const url = buildBackToMapUrlFromParams(dummyParams, spot, mockRegions);

    expect(url).toBe(
      "/map?country=united-states&city=new-york&region=north-america&spot=spot-123",
    );
  });
});
