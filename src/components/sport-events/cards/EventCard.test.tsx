import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SportEventEnriched } from "@/types/sport-events";
import { EventCard } from "./EventCard";

const EVENT: SportEventEnriched = {
  id: "e1",
  slug: "street league/paris",
  name: "Street League Paris",
  url: "https://example.com/sls",
  image: "https://example.com/event.jpg",
  description: "Test event",
  sports: ["Skateboard"],
  startDate: "2026-12-01",
  location: { city: "Paris", country: "France" },
  category: "world-tour",
  origin: "seed",
  visibility: "public",
  lifecycleStatus: "scheduled",
  timezone: "UTC",
  categoryName: "World Tour",
  instagram: "https://instagram.com/sls",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: "upcoming",
  dateRangeLabel: "DEC 1, 2026",
};

describe("EventCard", () => {
  it("links the card title to the internal event page", () => {
    render(<EventCard event={EVENT} />);
    expect(
      screen.getByRole("link", { name: "Street League Paris" }),
    ).toHaveAttribute("href", "/sport-events/street%20league%2Fparis");
  });

  it("keeps exactly one official-site link, opening in a new tab", () => {
    render(<EventCard event={EVENT} />);
    const official = screen.getAllByRole("link", { name: /official site/i });
    expect(official).toHaveLength(1);
    expect(official[0]).toHaveAttribute("href", "https://example.com/sls");
    expect(official[0]).toHaveAttribute("target", "_blank");
    expect(
      screen.getAllByRole("link", { name: /on instagram/i }),
    ).toHaveLength(1);
  });

  it("drops the description in the compact variant", () => {
    render(<EventCard event={EVENT} variant="compact" />);
    expect(screen.queryByText("Test event")).not.toBeInTheDocument();
  });
});
