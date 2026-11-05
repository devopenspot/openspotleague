import { describe, expect, it } from "vitest";
import { buildStatusFilterUrl, filterEventsByStatus } from "./status-filter";
import type { ContestEnriched } from "@/types/league";

function enriched(status: ContestEnriched["status"]): ContestEnriched {
  return {
    id: status,
    slug: status,
    name: status,
    url: "https://example.com/event",
    image: "https://example.com/event.jpg",
    description: "Test event",
    sports: ["Skateboard"],
    startDate: "2026-08-14",
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

describe("filterEventsByStatus", () => {
  const events = [enriched("upcoming"), enriched("live"), enriched("completed")];

  it("uses the existing enriched status without recalculating dates", () => {
    const result = filterEventsByStatus(events, "live", new Date("invalid"));
    expect(result.map((item) => item.id)).toEqual(["live"]);
  });

  it("returns all events for the implicit all status", () => {
    expect(filterEventsByStatus(events, "all")).toBe(events);
  });
});

describe("buildStatusFilterUrl", () => {
  it("sets status while preserving unrelated query parameters", () => {
    expect(
      buildStatusFilterUrl(
        "/league",
        new URLSearchParams("foo=bar"),
        "upcoming",
      ),
    ).toBe("/league?foo=bar&status=upcoming");
  });

  it("removes the implicit all status", () => {
    expect(
      buildStatusFilterUrl(
        "/league",
        new URLSearchParams("status=live&foo=bar"),
        "all",
      ),
    ).toBe("/league?foo=bar");
  });
});
