import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MatchList } from "@/components/games/matches/MatchList";
import { GUEST_TOKEN_HEADER, GUEST_TOKEN_STORAGE_KEY, createGuestToken } from "@/lib/games/guest";
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
    render(<MatchList authenticated limit={100} />);
    await waitFor(() => expect(screen.getAllByText("Finished").length).toBeGreaterThanOrEqual(2));
    const buttons = screen.getAllByRole("button", { name: /View results for/i });
    expect(buttons).toHaveLength(3);
  });

  it("lobby/active rows do not have enabled Results buttons", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).includes("/api/games?limit=")) {
        return new Response(JSON.stringify(mockGames), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
    render(<MatchList authenticated limit={100} />);
    await waitFor(() => expect(screen.getByText("Not started")).toBeInTheDocument());
    const buttons = screen.getAllByRole("button", { name: /View results for/i });
    // only 3 terminal
    expect(buttons).toHaveLength(3);
    // ensure active/lobby labels exist but not as buttons
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    // A battle that closed with no winner reads "Ended early".
    expect(screen.getByText("Ended early")).toBeInTheDocument();
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
    render(<MatchList authenticated limit={100} />);
    await waitFor(() => expect(screen.getAllByText("Finished").length).toBe(2));
    const btn = screen.getByRole("button", { name: /View results for Game of B\.L\.A\.D\.E — roller/i });
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
    render(<MatchList authenticated limit={100} />);
    await waitFor(() => expect(screen.getAllByText("Finished").length).toBe(2));
    const btn = screen.getByRole("button", { name: /View results for Game of B\.L\.A\.D\.E — roller/i });
    await user.click(btn);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("shows friendly copy next to the row, not the raw error body", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.includes("/api/games?limit=")) return new Response(JSON.stringify(mockGames), { status: 200 });
      return new Response(
        JSON.stringify({ error: "Conflicting identity claims", code: "NOT_AUTHORIZED" }),
        { status: 403 },
      );
    }));
    render(<MatchList authenticated limit={100} />);
    await waitFor(() => expect(screen.getAllByText("Finished").length).toBe(2));
    await user.click(screen.getByRole("button", { name: /View results for Game of B\.L\.A\.D\.E — roller/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You can't open these results.");
    expect(alert).not.toHaveTextContent(/Conflicting|NOT_AUTHORIZED/);
    expect(alert.closest("li")).toHaveTextContent("Game of B.L.A.D.E");
  });
});

describe("MatchList — results identity", () => {
  function captureResultsRequest() {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/games?limit=")) return new Response(JSON.stringify(mockGames), { status: 200 });
      calls.push(init ?? {});
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }));
    return calls;
  }

  function guestHeaderOf(init: RequestInit | undefined) {
    return new Headers(init?.headers).get(GUEST_TOKEN_HEADER);
  }

  beforeEach(() => {
    // A rider who once played as a guest keeps the token after signing in.
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, createGuestToken());
  });

  it("never sends the guest token for a signed-in rider", async () => {
    const user = userEvent.setup();
    const calls = captureResultsRequest();
    render(<MatchList authenticated limit={100} />);
    await waitFor(() => expect(screen.getAllByText("Finished").length).toBe(2));
    await user.click(screen.getByRole("button", { name: /View results for Game of B\.L\.A\.D\.E — roller/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(guestHeaderOf(calls[0])).toBeNull();
  });

  it("sends the guest token for a guest", async () => {
    const user = userEvent.setup();
    const calls = captureResultsRequest();
    render(<MatchList authenticated={false} limit={100} />);
    await waitFor(() => expect(screen.getAllByText("Finished").length).toBe(2));
    await user.click(screen.getByRole("button", { name: /View results for Game of B\.L\.A\.D\.E — roller/i }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(guestHeaderOf(calls[0])).toBe(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY));
  });
});

describe("MatchList — row copy", () => {
  it("names the battle spot and the status instead of raw ids", () => {
    render(
      <MatchList
        authenticated
        list={{
          status: "ready",
          games: [{ ...mockGames[0]!, status: "active", spotName: "Riverside Ledges" }],
        }}
      />,
    );
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Game of B.L.A.D.E")).toBeInTheDocument();
    expect(screen.getByText("Battle · Riverside Ledges · Rails")).toBeInTheDocument();
    expect(screen.queryByText(/Spot spot-1/)).toBeNull();
  });

  it("offers a retry when the list fails to load", async () => {
    const reload = vi.fn();
    render(<MatchList authenticated list={{ status: "error", games: [], reload }} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
