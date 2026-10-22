import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GameState, GameStage } from "@/lib/schemas/game";
import { buildAwardResult } from "@/lib/games/award-result";
import { AwardResultsTable } from "@/components/games/award/AwardResultsTable";

function makePlayer(overrides: Partial<GameState["players"][number]> & { id: string }): GameState["players"][number] {
  return {
    userId: `u-${overrides.id}`,
    displayName: overrides.displayName ?? `Player ${overrides.id}`,
    seatOrder: overrides.seatOrder ?? 0,
    letters: overrides.letters ?? "",
    failedAttempts: overrides.failedAttempts ?? 0,
    status: overrides.status ?? "active",
    ...overrides,
  } as GameState["players"][number];
}

function makeStage(overrides: Partial<GameStage> & { sequence: number; id: string }): GameStage {
  return {
    status: "resolved",
    challengerPlayerId: null,
    spotType: "rails",
    trickId: null,
    trickName: null,
    trickLevel: null,
    challengerResult: "pending",
    challengeOutcome: "resolved",
    leadRetained: false,
    attempts: [],
    scores: [],
    ...overrides,
  } as GameStage;
}

function gameFixture(overrides: Partial<GameState> = {}): GameState {
  const basePlayers: GameState["players"] = [
    makePlayer({ id: "p1", displayName: "Alice", seatOrder: 0 }),
    makePlayer({ id: "p2", displayName: "Bob", seatOrder: 1 }),
    makePlayer({ id: "p3", displayName: "Cara", seatOrder: 2 }),
  ];
  const base = {
    id: "game-1",
    createdBy: "u-p1",
    creatorDisplayName: "Alice",
    status: "complete",
    version: 1,
    shareCode: "abc123",
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
    locationRadiusMeters: null,
    nextSpotType: "rails",
    nextLevel: null,
    availableSpotTypes: [{ slug: "rails", name: "Rails", sortOrder: 1 }],
    currentChallengerPlayerId: null,
    winnerPlayerId: null,
    rotationIndex: 0,
    viewerPlayerId: "p1",
    viewerPoints: null,
    winnerBonus: null,
    viewerIsHost: false,
    players: basePlayers,
    currentRound: null,
    stageLedger: [],
  } as unknown as GameState;
  return { ...base, ...overrides } as GameState;
}

describe("AwardResultsTable", () => {
  it("dense ranking: [10,10,5] -> ranks 1,1,2", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p3", points: 5, eventTypes: ["response_landed"] },
        ],
      }),
    ];
    const result = buildAwardResult(gameFixture({ stageLedger: stages }));
    render(<AwardResultsTable result={result} />);
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 1, 2]);
    // ensure table caption exists
    expect(screen.getByText("Championship results — ranked by points")).toBeInTheDocument();
  });

  it("does not tie rank 1 when winner and eliminated player both have 0 points", () => {
    const game = gameFixture({
      winnerPlayerId: "p1",
      players: [
        makePlayer({ id: "p1", displayName: "Winner", status: "active", seatOrder: 0 }),
        makePlayer({ id: "p2", displayName: "RunnerUp", status: "eliminated", letters: "BIKE", seatOrder: 1 }),
      ],
      stageLedger: [],
    });
    const result = buildAwardResult(game);
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 2]);
  });

  it("solo renders single card, no rank column", () => {
    const solo = gameFixture({
      mode: "training",
      trainingVariant: "solo",
      players: [makePlayer({ id: "p1", displayName: "Solo", seatOrder: 0 })],
      stageLedger: [
        makeStage({ id: "s1", sequence: 1, attempts: [{ playerId: "p1", result: "landed" }], scores: [{ playerId: "p1", points: 8, eventTypes: ["challenger_landed"] }] }),
      ],
    });
    const result = buildAwardResult(solo);
    const { container } = render(<AwardResultsTable result={result} />);
    expect(screen.getByText("Solo")).toBeInTheDocument();
    expect(screen.queryByText("Rank")).not.toBeInTheDocument();
    expect(container.querySelector("table")).not.toBeInTheDocument();
  });

  it("winner row has Winner badge and viewer row has You pill", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 13, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 5, eventTypes: ["response_landed"] },
        ],
      }),
    ];
    const result = buildAwardResult(
      gameFixture({ winnerPlayerId: "p1", viewerPlayerId: "p1", stageLedger: stages }),
    );
    render(<AwardResultsTable result={result} />);
    expect(screen.getAllByText("Winner").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("You").length).toBeGreaterThanOrEqual(1);
    // header cells have scope col
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveAttribute("scope", "col");
    // rider cells scope row
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders.length).toBeGreaterThanOrEqual(2);
  });

  it("renders same data for each game in a 5-game batch (per-row isolation)", () => {
    const games = Array.from({ length: 5 }, (_, i) =>
      gameFixture({
        id: `game-${i}`,
        winnerPlayerId: i % 2 === 0 ? "p1" : null,
        stageLedger: [
          makeStage({
            id: `s-${i}`,
            sequence: 1,
            scores: [{ playerId: "p1", points: i * 5, eventTypes: ["challenger_landed"] }],
          }),
        ],
      }),
    );
    for (const g of games) {
      const result = buildAwardResult(g);
      const { unmount } = render(<AwardResultsTable result={result} />);
      // each result isolated — first game 0 pts, last 20 pts
      expect(result.ranking[0]?.points).toBe(result.totals.rounds === 0 ? 0 : parseInt(g.id.split("-")[1]!) * 5);
      unmount();
    }
  });
});
