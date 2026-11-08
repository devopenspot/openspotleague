import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileClient } from "./ProfileClient";
import { LEVEL_POINTS } from "@/lib/games/definitions";
import type { ProfileSummary, ProfileTricks } from "@/lib/services/profile/profile";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => ({ id: "user-1" }),
}));

const summary: ProfileSummary = {
  user: { id: "user-1", name: "Kai Rider", email: "kai@example.test", initials: "KR" },
  rank: "Street Learner",
  totalPoints: 1240,
  nextRank: { label: "Line Builder", pointsNeeded: 260 },
  progress: 0.6,
  stats: {
    totalPoints: 1240,
    gamesPlayed: 12,
    gamesWon: 7,
    tricksLanded: 40,
    tricksFailed: 10,
    eventsAttended: 2,
    eventsWon: 1,
  },
  leagueHistory: [],
  counts: { saved: 9, verified: 3, visited: 5 },
  activity: [{ date: "2026-11-06", count: 2, points: 13 }],
  preferences: { distanceUnit: "km", temperatureUnit: "C", disciplineSlug: "all" },
  streakDays: 5,
};

const tricks: ProfileTricks = {
  byLevel: { 1: 10, 2: 8, 3: 6, 4: 2, 5: 1 },
  totalLanded: 40,
  totalFailed: 10,
  recent: [{ name: "Kickflip", level: 2, points: 8, date: "2026-11-01T10:00:00.000Z" }],
};

const fetchMock = vi.fn((input: string) => {
  if (input.startsWith("/api/profile/tricks")) {
    return Promise.resolve({ ok: true, json: async () => tricks } as Response);
  }
  return Promise.resolve({ ok: true, json: async () => ({ items: [], nextCursor: null }) } as Response);
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/profile");
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileClient", () => {
  it("shows each headline fact once", async () => {
    render(<ProfileClient summary={summary} initialTab="overview" />);

    expect(screen.getByRole("heading", { level: 1, name: "Kai Rider" })).toBeInTheDocument();
    expect(screen.getAllByText("1,240 pts")).toHaveLength(1);
    expect(screen.getAllByText("260 pts to Line Builder")).toHaveLength(1);
    expect(screen.getAllByText(/5-day streak/)).toHaveLength(1);
    // Email belongs to the Account tab, not the hero.
    expect(screen.queryByText("kai@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText(/at a glance/i)).not.toBeInTheDocument();

    // Tricks are fetched once and shared by every panel.
    await waitFor(() => expect(screen.getByText(`L2 ${LEVEL_POINTS[2]}`, { exact: false })).toBeInTheDocument());
    expect(fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/profile/tricks"))).toHaveLength(1);
  });

  it("jumps from a stat tile to its tab and mirrors it in the URL", async () => {
    const user = userEvent.setup();
    render(<ProfileClient summary={summary} initialTab="overview" />);

    const totals = screen.getByRole("navigation", { name: "Profile totals" });
    await user.click(within(totals).getByRole("button", { name: /spots/i }));

    expect(screen.getByRole("tab", { name: "Spots" })).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?tab=spots");
    expect(screen.getByRole("button", { name: /saved\s*9/i })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(window.location.search).toBe("");
  });

  it("opens straight on the tab from the URL and shows all five trick levels", async () => {
    render(<ProfileClient summary={summary} initialTab="tricks" />);

    const levels = await screen.findByRole("list", { name: "Tricks landed by level" });
    expect(within(levels).getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByText("Kickflip")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => url.startsWith("/api/profile/tricks"))).toHaveLength(1);
  });

  it("puts preferences and a labelled sign out in Account", async () => {
    render(<ProfileClient summary={summary} initialTab="account" />);

    expect(screen.getByText("kai@example.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Main sport" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All sports" })).toBeInTheDocument();
  });
});
