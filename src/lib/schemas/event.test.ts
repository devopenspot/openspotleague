import { describe, expect, it } from "vitest";
import { SportEventEnrichedSchema } from "./event";
import { leagueCreateEventInputSchema } from "./league";

const validContest = {
  name: "Test contest",
  sports: ["Skateboard"],
  startDate: "2026-08-14",
  city: "Paris",
  country: "France",
  countryCode: "FR",
  timezone: "Europe/Paris",
  category: "festival",
};

describe("contest schemas", () => {
  it("accepts a minimal contest", () => {
    expect(leagueCreateEventInputSchema.safeParse(validContest).success).toBe(
      true,
    );
  });

  it("requires coordinates to be supplied as a pair", () => {
    const result = leagueCreateEventInputSchema.safeParse({
      ...validContest,
      latitude: 48.85,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-canonical city slugs and country codes", () => {
    expect(
      leagueCreateEventInputSchema.safeParse({
        ...validContest,
        citySlug: "Paris Center",
      }).success,
    ).toBe(false);
    expect(
      leagueCreateEventInputSchema.safeParse({
        ...validContest,
        countryCode: "fr",
      }).success,
    ).toBe(false);
  });

  it("accepts organizer links only as http(s) URLs", () => {
    expect(
      leagueCreateEventInputSchema.safeParse({
        ...validContest,
        url: "https://jam.example",
        instagram: "https://instagram.com/jam",
      }).success,
    ).toBe(true);
    expect(
      leagueCreateEventInputSchema.safeParse({
        ...validContest,
        youtube: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("validates enriched read DTOs", () => {
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
