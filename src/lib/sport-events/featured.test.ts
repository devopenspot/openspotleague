import { describe, expect, it } from "vitest";
import { selectFeaturedEvent } from "./featured";
import type { SportEventEnriched } from "@/types/sport-events";

function event(
  id: string,
  status: SportEventEnriched["status"],
  featured = false,
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
    location: { city: "Paris", country: "France" },
    category: "festival",
    categoryName: "Festival",
    origin: "seed",
    visibility: "public",
    lifecycleStatus: "scheduled",
    timezone: "UTC",
    featured,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status,
    dateRangeLabel: "AUG 14, 2026",
  };
}

describe("selectFeaturedEvent", () => {
  it("prefers a featured event that is not completed", () => {
    const events = [
      event("completed-featured", "completed", true),
      event("upcoming", "upcoming"),
      event("live-featured", "live", true),
    ];
    expect(selectFeaturedEvent(events)?.id).toBe("live-featured");
  });

  it("falls back to the first non-completed event", () => {
    const events = [event("past", "completed"), event("next", "upcoming")];
    expect(selectFeaturedEvent(events)?.id).toBe("next");
  });

  it("does not promote a completed-only list", () => {
    expect(selectFeaturedEvent([event("past", "completed")])).toBeUndefined();
  });
});
