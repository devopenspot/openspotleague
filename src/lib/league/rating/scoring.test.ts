import { describe, expect, it } from "vitest";
import { LeagueDomainError } from "../definitions";
import {
  assertElementTicks,
  bestTrickTotal,
  elementCompletion,
  judgeRunTotal,
  panelScore,
  rankBestTricks,
  rankDivision,
  type CriterionScores,
  type DivisionRunInput,
} from "./scoring";

const all = (value: number): CriterionScores => ({
  difficulty: value,
  style: value,
  amplitude: value,
  consistency: value,
  creativity: value,
});

function expectScoreInvalid(fn: () => unknown) {
  try {
    fn();
    throw new Error("expected a throw");
  } catch (error) {
    expect(error).toBeInstanceOf(LeagueDomainError);
    expect((error as LeagueDomainError).code).toBe("SCORE_INVALID");
  }
}

describe("judgeRunTotal", () => {
  it("is the mean of the 5 criteria times 10", () => {
    expect(judgeRunTotal({ difficulty: 8, style: 7.5, amplitude: 6, consistency: 9, creativity: 7 })).toBe(75);
    expect(judgeRunTotal(all(10))).toBe(100);
    expect(judgeRunTotal(all(0))).toBe(0);
  });

  it("requires every criterion", () => {
    expectScoreInvalid(() => judgeRunTotal({ difficulty: 8, style: 7 }));
  });

  it("only accepts 0.5 steps within 0–10", () => {
    expectScoreInvalid(() => judgeRunTotal({ ...all(5), style: 7.25 }));
    expectScoreInvalid(() => judgeRunTotal({ ...all(5), style: 10.5 }));
    expectScoreInvalid(() => judgeRunTotal({ ...all(5), style: -0.5 }));
    expect(judgeRunTotal({ ...all(5), style: 5.5 })).toBe(51);
  });

  it("rejects unknown criteria", () => {
    expectScoreInvalid(() => judgeRunTotal({ ...all(5), technique: 5 }));
  });
});

describe("bestTrickTotal", () => {
  it("averages difficulty and execution times 10", () => {
    expect(bestTrickTotal({ difficulty: 9, execution: 8 })).toBe(85);
  });
  it("requires both parts", () => {
    expectScoreInvalid(() => bestTrickTotal({ difficulty: 9 }));
  });
});

describe("panelScore", () => {
  it("is null with no judges", () => {
    expect(panelScore([])).toBeNull();
  });
  it("is the plain mean with 1 to 3 judges", () => {
    expect(panelScore([70])).toBe(70);
    expect(panelScore([60, 90, 75])).toBe(75);
  });
  it("drops one highest and one lowest with 4 judges", () => {
    expect(panelScore([50, 70, 80, 100])).toBe(75);
  });
  it("drops one highest and one lowest with 5 judges", () => {
    expect(panelScore([40, 70, 72, 74, 99])).toBe(72);
  });
});

describe("elementCompletion", () => {
  it("marks an element shown on a strict majority", () => {
    const result = elementCompletion(
      ["rotation", "transfer-air", "grinds"],
      [["rotation", "grinds"], ["rotation"], ["grinds"], []],
    );
    expect(result).toEqual([
      { elementId: "rotation", ticks: 2, shown: false },
      { elementId: "transfer-air", ticks: 0, shown: false },
      { elementId: "grinds", ticks: 2, shown: false },
    ]);
    expect(elementCompletion(["rotation"], [["rotation"], ["rotation"], []])[0]?.shown).toBe(true);
  });
  it("shows nothing without judges", () => {
    expect(elementCompletion(["rotation"], [])[0]?.shown).toBe(false);
  });
  it("rejects ticks outside the checklist", () => {
    expectScoreInvalid(() => assertElementTicks(["rotation", "nope"], new Set(["rotation"])));
    expect(assertElementTicks(["rotation", "rotation"], new Set(["rotation"]))).toEqual(["rotation"]);
  });
});

function run(partial: Partial<DivisionRunInput> & Pick<DivisionRunInput, "runId" | "order">): DivisionRunInput {
  return {
    userId: `u-${partial.runId}`,
    judgeTotals: [],
    judgeScores: [],
    ...partial,
  };
}

describe("rankDivision", () => {
  it("ranks by panel score and skips unscored runs", () => {
    const ranked = rankDivision([
      run({ runId: "a", order: 1, judgeTotals: [70], judgeScores: [all(7)] }),
      run({ runId: "b", order: 2, judgeTotals: [80], judgeScores: [all(8)] }),
      run({ runId: "c", order: 3 }),
    ]);
    expect(ranked.map((entry) => [entry.runId, entry.rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
  });

  it("breaks Street ties with the best trick first", () => {
    const ranked = rankDivision([
      run({ runId: "a", order: 1, judgeTotals: [80], judgeScores: [all(8)], bestTrickTotals: [70] }),
      run({ runId: "b", order: 2, judgeTotals: [80], judgeScores: [all(8)], bestTrickTotals: [90] }),
    ]);
    expect(ranked[0]?.runId).toBe("b");
    expect(ranked[0]?.bestTrickScore).toBe(90);
  });

  it("then by mean difficulty, then best judge, then order", () => {
    const hard = { ...all(8), difficulty: 9, creativity: 7 };
    const ranked = rankDivision([
      run({ runId: "a", order: 1, judgeTotals: [80], judgeScores: [all(8)] }),
      run({ runId: "b", order: 2, judgeTotals: [80], judgeScores: [hard] }),
      run({ runId: "c", order: 3, judgeTotals: [80], judgeScores: [all(8)] }),
    ]);
    expect(ranked.map((entry) => entry.runId)).toEqual(["b", "a", "c"]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });
});

describe("rankBestTricks", () => {
  it("ranks only runs with a best-trick score", () => {
    const ranked = rankBestTricks([
      run({ runId: "a", order: 1, bestTrickTotals: [60] }),
      run({ runId: "b", order: 2 }),
      run({ runId: "c", order: 3, bestTrickTotals: [95, 85] }),
    ]);
    expect(ranked).toEqual([
      { runId: "c", userId: "u-c", rank: 1, score: 90 },
      { runId: "a", userId: "u-a", rank: 2, score: 60 },
    ]);
  });
});
