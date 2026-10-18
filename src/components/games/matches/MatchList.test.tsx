import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MatchList } from "@/components/games/matches/MatchList";
import type { GameListItem } from "@/lib/schemas/game";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/games",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const mockGames: GameListItem[] = [
  {
    id: "game-1",
    status: "complete",
    shareCode: "share-1",
    mode: "challenge",
    disciplineSlug: "roller",
    gameName: "Play a Blade",
    spotId: "spot-1",
    scheduledStartAt: new Date("2026-01-01T12:00:00Z").toISOString(),
    nextSpotType: "rails",
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "game-2",
    status: "complete",
    shareCode: "share-2",
    mode: "training",
    disciplineSlug: "skateboard",
    gameName: "Play a Skate",
    spotId: null,
    scheduledStartAt: null,
    nextSpotType: "ledges",
    version: 2,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "game-3",
    status: "cancelled",
    shareCode: "share-3",
    mode: "challenge",
    disciplineSlug: "bmx",
    gameName: "Play a Bike",
    spotId: "spot-3",
    scheduledStartAt: null,
    nextSpotType: "rails",
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "game-4",
    status: "active",
    shareCode: "share-4",
    mode: "challenge",
    disciplineSlug: "scooter",
    gameName: "Play a Scoot",
    spotId: "spot-4",
    scheduledStartAt: null,
    nextSpotType: "rails",
    version: 1,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "game-5",
    status: "lobby",
    shareCode: "share-5",
    mode: "training",
    disciplineSlug: "roller",
    gameName: "Play a Blade",
    spotId: null,
    scheduledStartAt: null,
    nextSpotType: "rails",
    version: 1,
    updatedAt: new Date().toISOString(),
  },
];

function gameStateFixture(id: string) {
  return {
    id,
    createdBy: "u1",
    creatorDisplayName: "Alice",
    status: "complete",
    version: 1,
    shareCode: `share-${id}`,
    mode: "challenge",
    ruleMode: "flexible",
    trainingVariant: "multiplayer",
    disciplineSlug: "roller",
    challengeKey: "blade",
    gameName: "Play a Blade",
    eliminationWord: "BLADE",
    wordLength: 5,
    catalogId: null,
    spotId: null,
    scheduledStartAt: null,
    timezone: null,
    locationRadiusMeters: 250,
    nextSpotType: "rails",
    nextLevel: null,
    availableSpotTypes: [{ slug: "rails", name: "Rails", sortOrder: 1 }],
    currentChallengerPlayerId: null,
    winnerPlayerId: "p1",
    rotationIndex: 0,
    viewerPlayerId: null,
    viewerPoints: null,
    winnerBonus: null,
    viewerIsHost: false,
    players: [
      { id: "p1", userId: "u1", displayName: "Alice", seatOrder: 0, letters: "", failedAttempts: 0, status: "active" },
      { id: "p2", userId: "u2", displayName: "Bob", seatOrder: 1, letters: "BLA", failedAttempts: 3, status: "active" },
    ],
    currentRound: null,
    stageLedger: [
      {
        id: "s1",
        sequence: 1,
        status: "resolved",
        challengerPlayerId: "p1",
        spotType: "rails",
        trickId: "t1",
        trickName: "Trick",
        trickLevel: 1,
        challengerResult: "landed",
        challengeOutcome: "resolved",
        leadRetained: true,
        attempts: [{ playerId: "p2", result: "failed" }],
        scores: [{ playerId: "p1", points: 5, eventTypes: ["challenger_landed"] }],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MatchList — award history replay", () => {
  it("renders a Results button for each complete/cancelled row (3 of 5)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).includes("/api/games?limit=")) {
        return new Response(JSON.stringify(mockGames), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
    render(<MatchList bare limit={100} />);
    await waitFor(() => expect(screen.getAllByText("complete").length).toBeGreaterThanOrEqual(2));
    const buttons = screen.getAllByRole("button", { name: /View championship results/i });
    expect(buttons).toHaveLength(3);
  });

  it("lobby/active rows do not have enabled Results buttons", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).includes("/api/games?limit=")) {
        return new Response(JSON.stringify(mockGames), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
    render(<MatchList bare limit={100} />);
    await waitFor(() => expect(screen.getByText("lobby")).toBeInTheDocument());
    const buttons = screen.getAllByRole("button", { name: /View championship results/i });
    // only 3 terminal
    expect(buttons).toHaveLength(3);
    // ensure active/lobby labels exist but not as buttons
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("lobby")).toBeInTheDocument();
  });



  it("cold-fetch opens AwardDialog with correct gameId", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, _init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/games?limit=")) {
        return new Response(JSON.stringify(mockGames), { status: 200 });
      }
      if (u.includes("/api/games/game-1")) {
        return new Response(JSON.stringify(gameStateFixture("game-1")), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
    render(<MatchList bare limit={100} />);
    await waitFor(() => expect(screen.getAllByText("complete").length).toBe(2));
    const btn = screen.getByRole("button", { name: /View championship results for Play a Blade — roller/i });
    await user.click(btn);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(/Alice takes BLADE!/)).toBeInTheDocument();
  });

  it("handles fetch failure gracefully", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, _init2?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/games?limit=")) {
        return new Response(JSON.stringify(mockGames), { status: 200 });
      }
      if (u.includes("/api/games/game-1")) {
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
    render(<MatchList bare limit={100} />);
    await waitFor(() => expect(screen.getAllByText("complete").length).toBe(2));
    const btn = screen.getByRole("button", { name: /View championship results for Play a Blade — roller/i });
    await user.click(btn);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
