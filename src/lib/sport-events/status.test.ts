import { describe, expect, it } from "vitest";
import { deriveStatus } from "./status";
import type { SportEvent } from "@/types/sport-events";

function event(startDate: string, endDate?: string): SportEvent {
  return {
    id: "event-1",
    slug: "event-1",
    name: "Test event",
    url: "https://example.com/event",
    image: "https://example.com/event.jpg",
    description: "Test event",
    sports: ["Skateboard"],
    startDate,
    endDate,
    location: { city: "Paris", country: "France" },
    category: "festival",
    categoryName: "Festival",
    origin: "seed",
    visibility: "public",
    lifecycleStatus: "scheduled",
    timezone: "UTC",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("deriveStatus", () => {
  it("treats the start date at UTC midnight as live", () => {
    expect(
      deriveStatus(event("2026-08-14"), new Date("2026-08-14T00:00:00Z")),
    ).toBe("live");
  });

  it("keeps a one-day event live through the end of its UTC date", () => {
    expect(
      deriveStatus(event("2026-08-14"), new Date("2026-08-14T23:59:59Z")),
    ).toBe("live");
  });

  it("marks an event completed after its UTC end of day", () => {
    expect(
      deriveStatus(
        event("2026-08-14", "2026-08-16"),
        new Date("2026-08-17T00:00:00Z"),
      ),
    ).toBe("completed");
  });

  it("marks an event upcoming before its UTC start date", () => {
    expect(
      deriveStatus(event("2026-08-14"), new Date("2026-08-13T23:59:59Z")),
    ).toBe("upcoming");
  });
});
