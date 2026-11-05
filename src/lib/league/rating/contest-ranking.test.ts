import { describe, expect, it } from "vitest";
import { ledgerDivisionRankKey, rankContestDivisions } from "./contest-ranking";

const full = (value: number) => ({ difficulty: value, style: value, amplitude: value, consistency: value, creativity: value });

describe("rankContestDivisions", () => {
  const divisions = [
    { id: "street", format: "street" as const, hasBestTrick: true, sortOrder: 1 },
    { id: "park", format: "park" as const, hasBestTrick: false, sortOrder: 0 },
    { id: "legacy", format: "open" as const, hasBestTrick: false, sortOrder: 2 },
  ];
  const runs = [
    { id: "p1", userId: "a", divisionId: "park", sequence: 1, status: "scored" },
    { id: "p2", userId: "b", divisionId: "park", sequence: 2, status: "scored" },
    { id: "s1", userId: "a", divisionId: "street", sequence: 3, status: "scored" },
    { id: "s2", userId: "c", divisionId: "street", sequence: 4, status: "scored" },
    { id: "l1", userId: "d", divisionId: "legacy", sequence: 5, status: "scored" },
    { id: "skip", userId: "e", divisionId: "park", sequence: 6, status: "skipped" },
  ];
  const scores = [
    { runId: "p1", total: 60, scores: full(6), bestTrickTotal: null },
    { runId: "p2", total: 90, scores: full(9), bestTrickTotal: null },
    { runId: "s1", total: 80, scores: full(8), bestTrickTotal: 70 },
    { runId: "s2", total: 80, scores: full(8), bestTrickTotal: 95 },
    { runId: "l1", total: "7.5", scores: { style: 7, technique: 8 }, bestTrickTotal: null },
  ];

  it("ranks each division separately, in division order", () => {
    const ranked = rankContestDivisions(divisions, runs, scores);
    expect(ranked.map((entry) => [entry.divisionId, entry.userId, entry.rank])).toEqual([
      ["park", "b", 1],
      ["park", "a", 2],
      ["street", "c", 1],
      ["street", "a", 2],
      ["legacy", "d", 1],
    ]);
    expect(ranked.find((entry) => entry.userId === "c")?.bestTrickScore).toBe(95);
    expect(ranked.find((entry) => entry.divisionId === "legacy")?.score).toBe(7.5);
  });

  it("keys rank bonuses per division", () => {
    expect(ledgerDivisionRankKey("e1", "d1", "u1")).toBe("event:e1:division:d1:rider:u1:rank");
  });
});
