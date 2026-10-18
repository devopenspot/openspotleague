import { describe, expect, it } from "vitest";
import { orderEventsForDirectory } from "./directory-order";
import type { SportEventEnriched } from "@/types/sport-events";

function event(
  id: string,
  status: SportEventEnriched["status"],
  startDate: string,
): SportEventEnriched {
  return {
    id,
    slug: id,
    name: id,
    url: "https://example.com/event",
    image: "https://example.com/event.jpg",
    description: "Test event",
    sports: ["Skateboard"],
    startDate,
    location: { city: "Paris", country: "France" },
    category: "festival",
    origin: "seed",
    visibility: "public",
    lifecycleStatus: "scheduled",
    timezone: "UTC",
    categoryName: "Festival",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status,
    dateRangeLabel: "AUG 14, 2026",
  };
}

describe("orderEventsForDirectory", () => {
  it("places live and upcoming events before completed events", () => {
    const events = [
      event("past", "completed", "2026-05-01"),
      event("upcoming", "upcoming", "2026-08-14"),
      event("live", "live", "2026-08-10"),
    ];

    expect(orderEventsForDirectory(events).map((item) => item.id)).toEqual([
      "live",
      "upcoming",
      "past",
    ]);
  });

  it("orders upcoming events from nearest to oldest", () => {
    const events = [
      event("later", "upcoming", "2026-09-01"),
      event("earlier", "upcoming", "2026-08-14"),
    ];

    expect(orderEventsForDirectory(events).map((item) => item.id)).toEqual([
      "earlier",
      "later",
    ]);
  });

  it("orders completed events from most recent to oldest", () => {
    const events = [
      event("older", "completed", "2026-05-01"),
      event("recent", "completed", "2026-07-23"),
    ];

    expect(orderEventsForDirectory(events).map((item) => item.id)).toEqual([
      "recent",
      "older",
    ]);
  });

  it("uses the id as a deterministic tie-breaker", () => {
    const events = [
      event("event-b", "upcoming", "2026-08-14"),
      event("event-a", "upcoming", "2026-08-14"),
    ];

    expect(orderEventsForDirectory(events).map((item) => item.id)).toEqual([
      "event-a",
      "event-b",
    ]);
  });
});
