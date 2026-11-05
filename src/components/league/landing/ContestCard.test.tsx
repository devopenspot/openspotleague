import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ContestEnriched } from "@/types/league";
import { ContestCard } from "./ContestCard";

const EVENT: ContestEnriched = {
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

describe("ContestCard", () => {
  it("links the card title to the contest page", () => {
    render(<ContestCard event={EVENT} />);
    expect(
      screen.getByRole("link", { name: "Street League Paris" }),
    ).toHaveAttribute("href", "/league/street%20league%2Fparis");
  });

  it("keeps exactly one official-site link, opening in a new tab", () => {
    render(<ContestCard event={EVENT} />);
    const official = screen.getAllByRole("link", { name: /official site/i });
    expect(official).toHaveLength(1);
    expect(official[0]).toHaveAttribute("href", "https://example.com/sls");
    expect(official[0]).toHaveAttribute("target", "_blank");
    expect(
      screen.getAllByRole("link", { name: /on instagram/i }),
    ).toHaveLength(1);
  });

  it("drops the description in the compact variant", () => {
    render(<ContestCard event={EVENT} variant="compact" />);
    expect(screen.queryByText("Test event")).not.toBeInTheDocument();
  });
});

describe("ContestCard cover", () => {
  it("renders the designed fallback when the contest has no uploaded cover", () => {
    const { container } = render(
      <ContestCard event={{ ...EVENT, image: "/opengraph.png" }} />,
    );
    expect(
      container.querySelector('[data-contest-cover="fallback"]'),
    ).not.toBeNull();
  });

  it("renders the uploaded cover photo when there is one", () => {
    const { container } = render(<ContestCard event={EVENT} />);
    expect(
      container.querySelector('[data-contest-cover="fallback"]'),
    ).toBeNull();
  });
});
