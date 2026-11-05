/**
 * Ranks a whole contest, one division at a time. Used by publish (frozen
 * results) and by the provisional standings read. Rated divisions use the
 * Article 9 engine (`rankDivision`); legacy `open` divisions keep the
 * pre-0007 rule (plain mean of 0–10 judge totals). Pure: no IO.
 */
import { rankRuns, runTotal } from "../engine";
import { RATING_CRITERIA_KEYS } from "./criteria";
import type { ContestFormat } from "./formats";
import { rankDivision, type CriterionScores } from "./scoring";

export interface RankingDivision {
  id: string;
  format: ContestFormat;
  hasBestTrick: boolean;
  sortOrder: number;
}

export interface RankingRun {
  id: string;
  userId: string;
  divisionId: string;
  sequence: number;
  status: string;
}

export interface RankingScore {
  runId: string;
  total: string | number;
  scores: Readonly<Record<string, number>>;
  bestTrickTotal: string | number | null;
}

export interface ContestRankEntry {
  divisionId: string;
  runId: string;
  userId: string;
  rank: number;
  score: number;
  bestTrickScore: number | null;
}

function toCriterionScores(scores: Readonly<Record<string, number>>): CriterionScores | null {
  const result: Partial<Record<(typeof RATING_CRITERIA_KEYS)[number], number>> = {};
  for (const key of RATING_CRITERIA_KEYS) {
    const value = scores[key];
    if (typeof value !== "number") return null;
    result[key] = value;
  }
  return result as CriterionScores;
}

/** Ranked runs across every division, in division order then rank. */
export function rankContestDivisions(
  divisions: readonly RankingDivision[],
  runs: readonly RankingRun[],
  scores: readonly RankingScore[],
): ContestRankEntry[] {
  const scoresByRun = new Map<string, RankingScore[]>();
  for (const row of scores) {
    const list = scoresByRun.get(row.runId) ?? [];
    list.push(row);
    scoresByRun.set(row.runId, list);
  }
  const ordered = [...divisions].sort((a, b) => a.sortOrder - b.sortOrder);
  const out: ContestRankEntry[] = [];
  for (const division of ordered) {
    const divisionRuns = runs.filter(
      (run) => run.divisionId === division.id && (scoresByRun.get(run.id)?.length ?? 0) > 0,
    );
    if (divisionRuns.length === 0) continue;
    if (division.format === "open") {
      const rankable = divisionRuns.map((run) => {
        const totals = (scoresByRun.get(run.id) ?? []).map((row) => Number(row.total));
        return {
          runId: run.id,
          userId: run.userId,
          total: runTotal(totals),
          bestJudgeTotal: Math.max(...totals),
          sequence: run.sequence,
        };
      });
      const userByRun = new Map(rankable.map((run) => [run.runId, run.userId] as const));
      for (const entry of rankRuns(rankable)) {
        out.push({
          divisionId: division.id,
          runId: entry.runId,
          userId: userByRun.get(entry.runId) ?? "",
          rank: entry.rank,
          score: entry.total,
          bestTrickScore: null,
        });
      }
      continue;
    }
    const ranked = rankDivision(
      divisionRuns.map((run) => {
        const rows = scoresByRun.get(run.id) ?? [];
        const bestTricks = rows
          .map((row) => (row.bestTrickTotal === null ? null : Number(row.bestTrickTotal)))
          .filter((value): value is number => value !== null);
        return {
          runId: run.id,
          userId: run.userId,
          judgeTotals: rows.map((row) => Number(row.total)),
          judgeScores: rows
            .map((row) => toCriterionScores(row.scores))
            .filter((value): value is CriterionScores => value !== null),
          bestTrickTotals: division.hasBestTrick && bestTricks.length > 0 ? bestTricks : undefined,
          order: run.sequence,
        };
      }),
    );
    for (const entry of ranked) {
      out.push({
        divisionId: division.id,
        runId: entry.runId,
        userId: entry.userId,
        rank: entry.rank,
        score: entry.score,
        bestTrickScore: entry.bestTrickScore,
      });
    }
  }
  return out;
}

/** Ledger key for a rank bonus in one division (idempotent per rider). */
export function ledgerDivisionRankKey(eventId: string, divisionId: string, userId: string): string {
  return `event:${eventId}:division:${divisionId}:rider:${userId}:rank`;
}
