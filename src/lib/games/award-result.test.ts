import { describe, expect, it } from "vitest";
import type { GameState, GameStage, GameHistoryResponse } from "@/lib/schemas/game";
import { buildAwardResult, copyForResult, rankingForDisplay } from "./award-result";

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
  const base: GameState = {
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
    viewerPlayerId: null,
    viewerPoints: null,
    winnerBonus: null,
    viewerIsHost: false,
    players: basePlayers,
    currentRound: null,
    stageLedger: [],
  } as unknown as GameState;

  return { ...base, ...overrides } as GameState;
}

describe("award-result — dense ranking", () => {
  it("assigns dense ranks 1,1,2 for points [10,10,5]", () => {
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
    const game = gameFixture({ stageLedger: stages, players: [
      makePlayer({ id: "p1", displayName: "Alice", seatOrder: 0 }),
      makePlayer({ id: "p2", displayName: "Bob", seatOrder: 1 }),
      makePlayer({ id: "p3", displayName: "Cara", seatOrder: 2 }),
    ]});
    const result = buildAwardResult(game);
    expect(result.ranking.map((r) => ({ id: r.playerId, rank: r.rank }))).toEqual([
      { id: "p1", rank: 1 },
      { id: "p2", rank: 1 },
      { id: "p3", rank: 2 },
    ]);
  });

  it("dense tie progression 1,1,2,2 for points [10,10,5,5]", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p3", points: 5, eventTypes: ["response_landed"] },
          { playerId: "p4", points: 5, eventTypes: ["response_landed"] },
        ],
      }),
    ];
    const game = gameFixture({
      players: [
        makePlayer({ id: "p1", displayName: "Alice", seatOrder: 0 }),
        makePlayer({ id: "p2", displayName: "Bob", seatOrder: 1 }),
        makePlayer({ id: "p3", displayName: "Cara", seatOrder: 2 }),
        makePlayer({ id: "p4", displayName: "Dan", seatOrder: 3 }),
      ],
      stageLedger: stages,
    });
    const result = buildAwardResult(game);
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 1, 2, 2]);
  });

  it("winner always rank 1 even if points tied", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p3", points: 10, eventTypes: ["challenger_landed"] },
        ],
      }),
    ];
    const game = gameFixture({
      winnerPlayerId: "p2",
      stageLedger: stages,
    });
    const result = buildAwardResult(game);
    // winner must be first despite tie
    expect(result.ranking[0]?.playerId).toBe("p2");
    expect(result.ranking[0]?.rank).toBe(1);
    expect(result.ranking[0]?.isWinner).toBe(true);
    // all share rank 1 due to same points
    expect(result.ranking.map((r) => r.rank)).toEqual([1, 1, 1]);
  });

  it("winner with lower points still rank 1 (winner-first sort)", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 5, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 10, eventTypes: ["challenger_landed"] },
          { playerId: "p3", points: 8, eventTypes: ["challenger_landed"] },
        ],
      }),
    ];
    const game = gameFixture({ winnerPlayerId: "p1", stageLedger: stages });
    const result = buildAwardResult(game);
    expect(result.ranking[0]?.playerId).toBe("p1");
    expect(result.ranking[0]?.rank).toBe(1);
    // next rank determined by dense rule from winner's points
    expect(result.ranking[1]?.points).toBe(10);
    expect(result.ranking[1]?.rank).toBe(2);
  });
});

describe("award-result — elimination ordering", () => {
  it("ranks eliminated riders last despite early points when winner present", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [
          { playerId: "p1", points: 20, eventTypes: ["challenger_landed"] },
          { playerId: "p2", points: 15, eventTypes: ["response_landed"] },
          { playerId: "p3", points: 15, eventTypes: ["response_landed"] },
        ],
      }),
    ];
    const game = gameFixture({
      winnerPlayerId: "p1",
      players: [
        makePlayer({ id: "p1", displayName: "Alice", seatOrder: 0, status: "active", letters: "", failedAttempts: 0 }),
        makePlayer({ id: "p2", displayName: "Bob", seatOrder: 1, status: "eliminated", letters: "BLADE", failedAttempts: 5 }),
        makePlayer({ id: "p3", displayName: "Cara", seatOrder: 2, status: "eliminated", letters: "BLADE", failedAttempts: 5 }),
      ],
      stageLedger: stages,
    });
    const result = buildAwardResult(game);
    // winner first even though others have points
    expect(result.ranking[0]?.playerId).toBe("p1");
    // eliminated players after, sorted by failedAttempts/seatOrder
    expect(result.ranking.slice(1).every((r) => r.eliminated)).toBe(true);
  });
});

describe("award-result — solo single row", () => {
  it("solo returns soloRow + suppressed ranking render", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        attempts: [{ playerId: "p1", result: "landed" }],
        scores: [{ playerId: "p1", points: 5, eventTypes: ["challenger_landed"] }],
      }),
      makeStage({
        id: "s2",
        sequence: 2,
        attempts: [{ playerId: "p1", result: "failed" }],
        scores: [],
      }),
    ];
    const soloGame = gameFixture({
      mode: "training",
      trainingVariant: "solo",
      players: [makePlayer({ id: "p1", displayName: "Solo", seatOrder: 0 })],
      stageLedger: stages,
    });
    const result = buildAwardResult(soloGame);
    expect(result.variant).toBe("solo");
    expect(result.soloRow).not.toBeNull();
    expect(result.soloRow?.playerId).toBe("p1");
    expect(result.soloRow?.landed).toBe(1);
    expect(result.soloRow?.failed).toBe(1);
    expect(result.soloRow?.points).toBe(5);
    expect(result.copy.headline).toBe("Nice session!");
    expect(result.copy.badge).toBe("Session complete");
    // ranking still computed but caller renders soloRow only
    expect(result.ranking).toHaveLength(1);
  });
});

describe("award-result — no-winner variants", () => {
  it("cancelled with ledger → winner null, badge No champion, ranking still computed", () => {
    const stages: GameStage[] = [
      makeStage({
        id: "s1",
        sequence: 1,
        scores: [{ playerId: "p1", points: 8, eventTypes: ["challenger_landed"] }],
        attempts: [{ playerId: "p1", result: "landed" }],
      }),
    ];
    const game = gameFixture({ status: "cancelled", stageLedger: stages, winnerPlayerId: null });
    const result = buildAwardResult(game);
    expect(result.winner).toBeNull();
    expect(result.ranking.length).toBe(3);
    expect(result.copy.badge).toBe("No champion");
    expect(result.copy.headline).toBe("Session closed — no champion");
    expect(result.image.src).toBe("/challenges.jpg");
  });

  it("complete no winner with ledger → That's a wrap copy", () => {
    const stages: GameStage[] = [
      makeStage({ id: "s1", sequence: 1, scores: [{ playerId: "p1", points: 5, eventTypes: ["challenger_landed"] }] }),
    ];
    const game = gameFixture({ status: "complete", winnerPlayerId: null, stageLedger: stages });
    const result = buildAwardResult(game);
    expect(result.winner).toBeNull();
    expect(result.copy.headline).toBe("That’s a wrap — no champion");
    expect(result.copy.badge).toBe("Session complete");
  });
});

describe("award-result — per-row correctness", () => {
  it("builds 5 distinct AwardResults for 5 history rows without cross-contamination", () => {
    const games = Array.from({ length: 5 }, (_, i) =>
      gameFixture({
        id: `game-${i}`,
        stageLedger: [
          makeStage({
            id: `s-${i}`,
            sequence: 1,
            scores: [{ playerId: "p1", points: i * 5, eventTypes: ["challenger_landed"] }],
          }),
        ],
        winnerPlayerId: i % 2 === 0 ? "p1" : null,
      }),
    );
    const results = games.map((g) => buildAwardResult(g));
    expect(results.map((r) => r.gameId)).toEqual(["game-0", "game-1", "game-2", "game-3", "game-4"]);
    // mutate one result should not affect others
    const firstRanking = results[0]?.ranking[0]?.points;
    expect(firstRanking).toBe(0);
    expect(results[4]?.ranking[0]?.points).toBe(20);
    // winners alternate
    expect(results[0]?.winner?.playerId).toBe("p1");
    expect(results[1]?.winner).toBeNull();
  });
});

describe("award-result — history enrichment", () => {
  it("prefers history.rounds when provided else falls back to game.stageLedger", () => {
    const liveStage = makeStage({
      id: "live-s1",
      sequence: 1,
      spotType: "rails",
      scores: [{ playerId: "p1", points: 5, eventTypes: ["challenger_landed"] }],
    });
    const historyStage = makeStage({
      id: "hist-s1",
      sequence: 1,
      spotType: "ledges",
      scores: [{ playerId: "p1", points: 21, eventTypes: ["challenger_landed"] }],
    });
    const game = gameFixture({ stageLedger: [liveStage] });
    const history: GameHistoryResponse = {
      rounds: [historyStage],
      attempts: [],
      scoreEvents: [],
      raceLaps: [],
      nextRoundCursor: null,
      nextLapCursor: null,
    };
    const withHistory = buildAwardResult(game, history);
    const withoutHistory = buildAwardResult(game, null);
    expect(withHistory.ranking[0]?.points).toBe(21);
    expect(withHistory.totals.spotTypesUsed).toEqual(["ledges"]);
    expect(withHistory.source).toBe("history");
    expect(withoutHistory.ranking[0]?.points).toBe(5);
    expect(withoutHistory.totals.spotTypesUsed).toEqual(["rails"]);
    expect(withoutHistory.source).toBe("live");
  });
});

describe("award-result — image mapping static", () => {
  it("challenge → /challenges.jpg, training → /trainings.jpg", () => {
    const challenge = buildAwardResult(gameFixture({ mode: "challenge" }));
    const training = buildAwardResult(gameFixture({ mode: "training" }));
    expect(challenge.image.src).toBe("/challenges.jpg");
    expect(challenge.image.alt).toContain("Challenge");
    expect(training.image.src).toBe("/trainings.jpg");
    expect(training.image.alt).toContain("Training");
  });
});

describe("award-result — helpers", () => {
  it("rankingForDisplay and copyForResult return same as result fields", () => {
    const game = gameFixture({ winnerPlayerId: "p1", stageLedger: [
      makeStage({ id: "s1", sequence: 1, scores: [{ playerId: "p1", points: 10, eventTypes: ["challenger_landed"] }] }),
    ]});
    const result = buildAwardResult(game);
    expect(rankingForDisplay(result)).toBe(result.ranking);
    expect(copyForResult(result)).toBe(result.copy);
  });

  it("totals rounds and spotTypesUsed are derived from stages", () => {
    const stages: GameStage[] = [
      makeStage({ id: "s1", sequence: 1, spotType: "rails", scores: [] }),
      makeStage({ id: "s2", sequence: 2, spotType: "ledges", scores: [] }),
      makeStage({ id: "s3", sequence: 3, spotType: "rails", scores: [] }),
    ];
    const result = buildAwardResult(gameFixture({ stageLedger: stages }));
    expect(result.totals.rounds).toBe(3);
    expect(result.totals.spotTypesUsed).toEqual(expect.arrayContaining(["rails", "ledges"]));
    expect(result.totals.spotTypesUsed).toHaveLength(2);
  });

  it("infers winner from sole active player when winnerPlayerId is null and status complete", () => {
    const game = gameFixture({
      status: "complete",
      winnerPlayerId: null,
      players: [
        makePlayer({ id: "p1", displayName: "Alice", seatOrder: 0, status: "active" }),
        makePlayer({ id: "p2", displayName: "Bob", seatOrder: 1, status: "eliminated", letters: "BLADE", failedAttempts: 5 }),
        makePlayer({ id: "p3", displayName: "Cara", seatOrder: 2, status: "eliminated", letters: "BLADE", failedAttempts: 5 }),
      ],
      stageLedger: [makeStage({ id: "s1", sequence: 1, scores: [{ playerId: "p1", points: 13, eventTypes: ["challenger_landed"] }] })],
    });
    const result = buildAwardResult(game);
    expect(result.winner?.playerId).toBe("p1");
    expect(result.winner?.isWinner).toBe(true);
  });
});
