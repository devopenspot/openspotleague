import { describe, expect, it } from "vitest";
import {
  NewSportEventSchema,
  SportEventEnrichedSchema,
  SportEventPatchSchema,
} from "./event";

const validEvent = {
  name: "Test event",
  url: "https://example.com/event",
  image: "https://example.com/event.jpg",
  startDate: "2026-08-14",
  city: "Paris",
  country: "France",
  countryCode: "FR",
  category: "festival",
};

describe("sport event schemas", () => {
  it("rejects an end date before the start date", () => {
    const result = NewSportEventSchema.safeParse({
      ...validEvent,
      endDate: "2026-08-13",
    });
    expect(result.success).toBe(false);
  });

  it("requires coordinates to be supplied as a pair", () => {
    const result = NewSportEventSchema.safeParse({
      ...validEvent,
      latitude: 48.85,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-canonical city slugs and country codes", () => {
    expect(
      NewSportEventSchema.safeParse({
        ...validEvent,
        citySlug: "Paris Center",
      }).success,
    ).toBe(false);
    expect(
      NewSportEventSchema.safeParse({
        ...validEvent,
        countryCode: "fr",
      }).success,
    ).toBe(false);
  });

  it("allows a partial date patch for repository-level merge validation", () => {
    expect(SportEventPatchSchema.safeParse({ startDate: "2026-08-20" }).success).toBe(
      true,
    );
  });

  it("validates enriched read DTOs separately from write inputs", () => {
    const result = SportEventEnrichedSchema.safeParse({
      id: "event-1",
      slug: "test-event",
      name: "Test event",
      url: "https://example.com/event",
      image: "https://example.com/event.jpg",
      description: "Festival",
      sports: ["Skateboard"],
      startDate: "2026-08-14",
      location: { city: "Paris", country: "France" },
      category: "festival",
      categoryName: "Festival",
      origin: "seed",
      visibility: "public",
      lifecycleStatus: "scheduled",
      timezone: "UTC",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      status: "upcoming",
      dateRangeLabel: "AUG 14, 2026",
    });

    expect(result.success).toBe(true);
  });
});
