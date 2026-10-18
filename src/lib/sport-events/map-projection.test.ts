import { describe, expect, it } from "vitest";
import { projectMapEvent, projectMapEvents } from "./map-projection";
import type { SportEventEnriched } from "@/types/sport-events";

function event(
  id: string,
  coordinates?: { latitude: number; longitude: number },
): SportEventEnriched {
  return {
    id,
    slug: id,
    name: id,
    url: "https://example.com/event",
    image: "https://example.com/event.jpg",
    description: "Test event",
    sports: ["Skateboard"],
    startDate: "2026-08-14",
    location: {
      city: "Paris",
      country: "France",
      ...coordinates,
    },
    category: "festival",
    origin: "seed",
    visibility: "public",
    lifecycleStatus: "scheduled",
    timezone: "UTC",
    categoryName: "Festival",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "upcoming",
    dateRangeLabel: "AUG 14, 2026",
  };
}

describe("map event projection", () => {
  it("drops events without coordinates from the marker DTO", () => {
    expect(projectMapEvent(event("missing-location"))).toBeNull();
  });

  it("keeps only the fields required by map consumers", () => {
    const projected = projectMapEvent(event("located", { latitude: 48.85, longitude: 2.35 }));
    expect(projected).toEqual({
      id: "located",
      slug: "located",
      name: "located",
      city: "Paris",
      country: "France",
      category: "festival",
      categoryName: "Festival",
      status: "upcoming",
      dateRangeLabel: "AUG 14, 2026",
      startDate: "2026-08-14",
      url: "https://example.com/event",
      lat: 48.85,
      lon: 2.35,
    });
  });

  it("enforces the marker limit after dropping invalid locations", () => {
    const projected = projectMapEvents(
      [
        event("missing-location"),
        event("first", { latitude: 48.85, longitude: 2.35 }),
        event("second", { latitude: 52.52, longitude: 13.4 }),
      ],
      1,
    );
    expect(projected.map((item) => item.id)).toEqual(["first"]);
  });
});
