import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import SportEventsLayout from "@/app/sport-events/layout";
import type { ContestEnriched } from "@/types/league";
import { SportEventsTab } from "./SportEventsTab";

const { push, replace, user, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  user: { current: null as null | { id: string; name: string; email: string } },
  search: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/sport-events",
  useSearchParams: () => new URLSearchParams(search.current),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => user.current,
}));

function event(
  id: string,
  status: ContestEnriched["status"],
  startDate: string,
): ContestEnriched {
  return {
    id,
    slug: `${id}-slug`,
    name: `Event ${id}`,
    url: `https://example.com/${id}`,
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

const EVENTS = [
  event("a", "upcoming", "2026-12-01"),
  event("b", "upcoming", "2027-01-10"),
  event("c", "completed", "2026-06-01"),
];

describe("SportEventsTab league entries", () => {
  it("hides the create CTA from guests but keeps join-by-code and My league", () => {
    user.current = null;
    render(<SportEventsTab featured={undefined} events={[]} />);
    expect(
      screen.queryByRole("link", { name: /create event/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my league/i })).toHaveAttribute(
      "href",
      "/league",
    );
    expect(
      screen.getByRole("button", { name: /join with code/i }),
    ).toBeInTheDocument();
  });

  it("shows the create CTA only for signed-in users", () => {
    user.current = { id: "u1", name: "Organizer", email: "u@x.dev" };
    render(<SportEventsTab featured={undefined} events={[]} />);
    expect(
      screen.getByRole("link", { name: /create event/i }),
    ).toHaveAttribute("href", "/league/new");
    expect(screen.getByRole("link", { name: /my league/i })).toBeInTheDocument();
  });
});

describe("SportEventsTab directory", () => {
  it("wraps routes in the events wash with a visible h1 and segmented filter", () => {
    search.current = "";
    const { container } = render(
      <SportEventsLayout>
        <SportEventsTab featured={undefined} events={EVENTS} />
      </SportEventsLayout>,
    );
    expect(container.firstElementChild).toHaveClass("bg-gradient-events");
    expect(
      screen.getByRole("heading", { level: 1, name: "Sport Events" }),
    ).toBeVisible();
    const filter = screen.getByRole("group", {
      name: /filter events by status/i,
    });
    expect(
      within(filter).getByRole("button", { name: /^all/i }),
    ).toHaveAttribute("aria-pressed", "true");
    // Live has no events and is not active, so it is hidden.
    expect(
      within(filter).queryByRole("button", { name: /^live/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /browse the federations/i }),
    ).toBeInTheDocument();
  });

  it("features the first active event and splits past events into their own section", () => {
    search.current = "";
    render(<SportEventsTab featured={undefined} events={EVENTS} />);
    expect(
      screen.getByRole("link", { name: /view event/i }),
    ).toHaveAttribute("href", "/sport-events/a-slug");
    const upcoming = screen.getByRole("region", { name: /live & upcoming/i });
    expect(within(upcoming).getByRole("link", { name: "Event b" })).toHaveAttribute(
      "href",
      "/sport-events/b-slug",
    );
    const past = screen.getByRole("region", { name: /past events/i });
    expect(within(past).getByRole("link", { name: "Event c" })).toHaveAttribute(
      "href",
      "/sport-events/c-slug",
    );
    expect(within(upcoming).queryByText("Event c")).not.toBeInTheDocument();
  });

  it("shows only past events, with no featured hero, under the Past filter", () => {
    search.current = "status=completed";
    render(<SportEventsTab featured={undefined} events={EVENTS} />);
    expect(
      screen.queryByRole("region", { name: /featured/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /live & upcoming/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /past events/i })).toBeInTheDocument();
  });

  it("offers a reset when a filter has no results", () => {
    search.current = "status=live";
    render(<SportEventsTab featured={undefined} events={EVENTS} />);
    expect(
      screen.getByRole("link", { name: /show all events/i }),
    ).toHaveAttribute("href", "/sport-events");
  });
});
