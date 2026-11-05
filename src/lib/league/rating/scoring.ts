/**
 * League rating math (Article 9 criteria, owner-chosen scale):
 *
 * - Each judge scores 5 criteria, 0–10 in 0.5 steps, equal weight.
 * - A judge's run total = mean of the 5 × 10 → 0–100.
 * - Panel score = trimmed mean: with 4+ judges drop one highest and one
 *   lowest total; otherwise plain mean.
 * - Street best trick: difficulty + execution, same scale and panel rule,
 *   used as the first tie-breaker and for its own board.
 * - Required elements: a judge checklist; an element counts as shown when
 *   a strict majority of the panel ticked it. Never affects the score.
 *
 * Pure: no IO. Throws LeagueDomainError("SCORE_INVALID") on bad input.
 */
import { LeagueDomainError } from "../definitions";
import {
  BEST_TRICK_KEYS,
  CRITERION_MAX_SCORE,
  CRITERION_STEP,
  RATING_CRITERIA_KEYS,
  type BestTrickKey,
  type RatingCriterionKey,
} from "./criteria";

/** Judges needed before the highest and lowest totals are dropped. */
export const TRIM_MIN_JUDGES = 4;

export type CriterionScores = Readonly<Record<RatingCriterionKey, number>>;
export type BestTrickScores = Readonly<Record<BestTrickKey, number>>;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function assertStepValue(label: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new LeagueDomainError("SCORE_INVALID", `Set a score for ${label}: every criterion is required`);
  }
  if (value < 0 || value > CRITERION_MAX_SCORE) {
    throw new LeagueDomainError(
      "SCORE_INVALID",
      `${label} must be between 0 and ${CRITERION_MAX_SCORE}`,
    );
  }
  const steps = value / CRITERION_STEP;
  if (Math.abs(steps - Math.round(steps)) > 1e-9) {
    throw new LeagueDomainError(
      "SCORE_INVALID",
      `${label} must use steps of ${CRITERION_STEP}`,
    );
  }
  return value;
}

function meanTimesTen(values: readonly number[]): number {
  const sum = values.reduce((acc, value) => acc + value, 0);
  return round2((sum / values.length) * 10);
}

/** Validates all 5 criteria and returns the judge's run total (0–100). */
export function judgeRunTotal(scores: Readonly<Record<string, unknown>>): number {
  const extra = Object.keys(scores).filter(
    (key) => !(RATING_CRITERIA_KEYS as readonly string[]).includes(key),
  );
  if (extra.length > 0) {
    throw new LeagueDomainError("SCORE_INVALID", `Unknown criteria: ${extra.join(", ")}`);
  }
  const values = RATING_CRITERIA_KEYS.map((key) => assertStepValue(key, scores[key]));
  return meanTimesTen(values);
}

/** Validates a best-trick score and returns its total (0–100). */
export function bestTrickTotal(scores: Readonly<Record<string, unknown>>): number {
  const values = BEST_TRICK_KEYS.map((key) => assertStepValue(`best trick ${key}`, scores[key]));
  return meanTimesTen(values);
}

/**
 * Panel aggregation. With TRIM_MIN_JUDGES or more totals, one highest and one
 * lowest are dropped; otherwise the plain mean. Null when nobody scored.
 */
export function panelScore(judgeTotals: readonly number[]): number | null {
  if (judgeTotals.length === 0) return null;
  const sorted = [...judgeTotals].sort((a, b) => a - b);
  const counted = sorted.length >= TRIM_MIN_JUDGES ? sorted.slice(1, -1) : sorted;
  const sum = counted.reduce((acc, value) => acc + value, 0);
  return round2(sum / counted.length);
}

/** Mean of one criterion across the panel (tie-breaker), 0–10. */
export function panelCriterionMean(
  judgeScores: readonly CriterionScores[],
  key: RatingCriterionKey,
): number | null {
  if (judgeScores.length === 0) return null;
  const sum = judgeScores.reduce((acc, scores) => acc + scores[key], 0);
  return round2(sum / judgeScores.length);
}

export interface ElementCompletion {
  elementId: string;
  shown: boolean;
  ticks: number;
}

/**
 * Strict-majority rule per element over the judges who scored the run.
 * `elementIds` keeps the division's checklist order.
 */
export function elementCompletion(
  elementIds: readonly string[],
  judgeTicks: readonly (readonly string[])[],
): ElementCompletion[] {
  const judges = judgeTicks.length;
  return elementIds.map((elementId) => {
    const ticks = judgeTicks.filter((ticked) => ticked.includes(elementId)).length;
    return { elementId, ticks, shown: judges > 0 && ticks * 2 > judges };
  });
}

/** Rejects ticks that are not on the division's checklist. */
export function assertElementTicks(ticks: readonly string[], allowed: ReadonlySet<string>): string[] {
  const unique = [...new Set(ticks)];
  const unknown = unique.filter((id) => !allowed.has(id));
  if (unknown.length > 0) {
    throw new LeagueDomainError("SCORE_INVALID", `Unknown elements: ${unknown.join(", ")}`);
  }
  return unique;
}

export interface DivisionRunInput {
  runId: string;
  userId: string;
  judgeTotals: readonly number[];
  judgeScores: readonly CriterionScores[];
  /** Street only: each judge's best-trick total. */
  bestTrickTotals?: readonly number[];
  /** Lower wins the last tie-break (live sequence or video submission order). */
  order: number;
}

export interface RankedDivisionRun {
  runId: string;
  userId: string;
  rank: number;
  score: number;
  bestTrickScore: number | null;
  difficultyMean: number;
  bestJudgeTotal: number;
}

/**
 * Ranks the scored runs of one division. Unscored runs are excluded.
 * Order: panel score ↓ → best-trick panel ↓ (Street) → mean difficulty ↓ →
 * best single judge total ↓ → order ↑. Ranks are distinct (1..N).
 */
export function rankDivision(runs: readonly DivisionRunInput[]): RankedDivisionRun[] {
  const scored = runs.flatMap((run) => {
    const score = panelScore(run.judgeTotals);
    if (score === null) return [];
    return [
      {
        run,
        score,
        bestTrickScore: run.bestTrickTotals ? panelScore(run.bestTrickTotals) : null,
        difficultyMean: panelCriterionMean(run.judgeScores, "difficulty") ?? 0,
        bestJudgeTotal: Math.max(...run.judgeTotals),
      },
    ];
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (b.bestTrickScore ?? -1) - (a.bestTrickScore ?? -1) ||
      b.difficultyMean - a.difficultyMean ||
      b.bestJudgeTotal - a.bestJudgeTotal ||
      a.run.order - b.run.order,
  );
  return scored.map((entry, index) => ({
    runId: entry.run.runId,
    userId: entry.run.userId,
    rank: index + 1,
    score: entry.score,
    bestTrickScore: entry.bestTrickScore,
    difficultyMean: entry.difficultyMean,
    bestJudgeTotal: entry.bestJudgeTotal,
  }));
}

/** Best-trick board for a Street division: best-trick panel ↓ → order ↑. */
export function rankBestTricks(
  runs: readonly DivisionRunInput[],
): { runId: string; userId: string; rank: number; score: number }[] {
  return runs
    .flatMap((run) => {
      const score = run.bestTrickTotals ? panelScore(run.bestTrickTotals) : null;
      return score === null ? [] : [{ run, score }];
    })
    .sort((a, b) => b.score - a.score || a.run.order - b.run.order)
    .map((entry, index) => ({
      runId: entry.run.runId,
      userId: entry.run.userId,
      rank: index + 1,
      score: entry.score,
    }));
}
