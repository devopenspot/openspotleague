import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { LeagueWash } from "./LeagueWash";
import type { ContestEnriched } from "@/types/league";
import { LeagueLanding } from "./LeagueLanding";

const { push, replace, user, search } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  user: { current: null as null | { id: string; name: string; email: string } },
  search: { current: "" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/league",
  useSearchParams: () => new URLSearchParams(search.current),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => user.current,
}));

vi.mock("./MyContests", () => ({
  MyContests: () => <section aria-label="My contests stub" />,
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

describe("LeagueLanding entries", () => {
  it("shows guests join-by-code but no create CTA and no My contests", () => {
    user.current = null;
    render(<LeagueLanding featured={undefined} events={[]} />);
    expect(
      screen.queryByRole("link", { name: /create a contest/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /my contests stub/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /join with code/i }),
    ).toBeInTheDocument();
  });

  it("shows signed-in users the create CTA and their own contests", () => {
    user.current = { id: "u1", name: "Organizer", email: "u@x.dev" };
    render(<LeagueLanding featured={undefined} events={[]} />);
    expect(
      screen.getByRole("link", { name: /create a contest/i }),
    ).toHaveAttribute("href", "/league/new");
    expect(
      screen.getByRole("region", { name: /my contests stub/i }),
    ).toBeInTheDocument();
  });

  it("explains that public listings arrive with paid tiers when the directory is empty", () => {
    user.current = null;
    search.current = "";
    render(<LeagueLanding featured={undefined} events={[]} />);
    expect(screen.getByText("No public contests yet")).toBeInTheDocument();
    expect(screen.getByText(/arrive with the paid tiers/i)).toBeInTheDocument();
  });
});

describe("LeagueLanding directory", () => {
  it("renders on the league wash with a visible h1 and segmented filter", () => {
    search.current = "";
    const { container } = render(
      <LeagueWash>
        <LeagueLanding featured={undefined} events={EVENTS} />
      </LeagueWash>,
    );
    expect(container.firstElementChild).toHaveClass("bg-gradient-league");
    expect(
      screen.getByRole("heading", { level: 1, name: "Contests" }),
    ).toBeVisible();
    const filter = screen.getByRole("group", {
      name: /filter contests by status/i,
    });
    expect(
      within(filter).getByRole("button", { name: /^all/i }),
    ).toHaveAttribute("aria-pressed", "true");
    // Live has no events and is not active, so it is hidden.
    expect(
      within(filter).queryByRole("button", { name: /^live/i }),
    ).not.toBeInTheDocument();
  });

  it("features the first active contest and splits past contests into their own section", () => {
    search.current = "";
    render(<LeagueLanding featured={undefined} events={EVENTS} />);
    expect(
      screen.getByRole("link", { name: /view contest/i }),
    ).toHaveAttribute("href", "/league/a-slug");
    const upcoming = screen.getByRole("region", { name: /live & upcoming/i });
    expect(within(upcoming).getByRole("link", { name: "Event b" })).toHaveAttribute(
      "href",
      "/league/b-slug",
    );
    const past = screen.getByRole("region", { name: /past contests/i });
    expect(within(past).getByRole("link", { name: "Event c" })).toHaveAttribute(
      "href",
      "/league/c-slug",
    );
    expect(within(upcoming).queryByText("Event c")).not.toBeInTheDocument();
  });

  it("shows only past contests, with no featured hero, under the Past filter", () => {
    search.current = "status=completed";
    render(<LeagueLanding featured={undefined} events={EVENTS} />);
    expect(
      screen.queryByRole("region", { name: /featured/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /live & upcoming/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /past contests/i })).toBeInTheDocument();
  });

  it("offers a reset when a filter has no results", () => {
    search.current = "status=live";
    render(<LeagueLanding featured={undefined} events={EVENTS} />);
    expect(
      screen.getByRole("link", { name: /show all contests/i }),
    ).toHaveAttribute("href", "/league");
  });
});
