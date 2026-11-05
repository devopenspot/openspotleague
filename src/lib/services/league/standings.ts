/**
 * League reads for leaderboards: per-contest standings (provisional while
 * judging, frozen once published) and the global League ranking built from
 * the points ledger. Reads only — writers stay in ./index.ts.
 *
 * Visibility:
 * - Provisional standings: active members only, panel totals only (no
 *   per-judge detail). Never cached.
 * - Published standings: anyone for public contests (cached remote),
 *   members only for unlisted ones.
 */
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDbClient, withDbRead } from "@/lib/db/client";
import {
  eventDivisions,
  eventMemberships,
  eventPointsLedger,
  eventResults,
  eventRuns,
  eventScores,
  profiles,
  sportEvents,
} from "@/db/schema";
import { ITEM_CACHE_LIFE, LIST_CACHE_LIFE } from "@/lib/cache/lifetimes";
import { rankBestTricks } from "@/lib/league/rating/scoring";
import { rankContestDivisions } from "@/lib/league/rating/contest-ranking";
import {
  divisionLabel,
  isRatingDiscipline,
  type ContestFormat,
} from "@/lib/league/rating/formats";

export interface StandingRow {
  rank: number;
  userId: string;
  riderName: string;
  ageCategory: "junior" | "senior" | null;
  city: string | null;
  score: number;
  bestTrickScore: number | null;
  /** League points; only once published. */
  pointsAwarded: number | null;
}

export interface DivisionStandings {
  divisionId: string;
  label: string;
  format: ContestFormat;
  hasBestTrick: boolean;
  rows: StandingRow[];
  bestTricks: { rank: number; userId: string; riderName: string; score: number }[];
}

export interface ContestStandings {
  eventId: string;
  published: boolean;
  divisions: DivisionStandings[];
}

interface DivisionMeta {
  id: string;
  disciplineSlug: string;
  format: ContestFormat;
  hasBestTrick: boolean;
  sortOrder: number;
}

function labelFor(division: DivisionMeta): string {
  return isRatingDiscipline(division.disciplineSlug)
    ? divisionLabel(division.disciplineSlug, division.format)
    : `${division.disciplineSlug} · ${division.format}`;
}

async function loadStandingsData(eventId: string, published: boolean): Promise<ContestStandings> {
  const { db } = getDbClient();
  const divisions: DivisionMeta[] = await db
    .select({
      id: eventDivisions.id,
      disciplineSlug: eventDivisions.disciplineSlug,
      format: eventDivisions.format,
      hasBestTrick: eventDivisions.hasBestTrick,
      sortOrder: eventDivisions.sortOrder,
    })
    .from(eventDivisions)
    .where(eq(eventDivisions.eventId, eventId))
    .orderBy(eventDivisions.sortOrder, eventDivisions.id);

  const riders = await db
    .select({
      userId: eventMemberships.userId,
      name: profiles.displayName,
      ageCategory: eventMemberships.ageCategory,
      city: eventMemberships.riderCity,
    })
    .from(eventMemberships)
    .leftJoin(profiles, eq(profiles.id, eventMemberships.userId))
    .where(and(eq(eventMemberships.eventId, eventId), eq(eventMemberships.role, "rider")));
  const riderInfo = new Map(riders.map((rider) => [rider.userId, rider] as const));
  const nameFor = (userId: string) => riderInfo.get(userId)?.name ?? `Rider ${userId.slice(0, 6)}`;
  const row = (entry: { rank: number; userId: string; score: number; bestTrickScore: number | null; pointsAwarded: number | null }): StandingRow => {
    const info = riderInfo.get(entry.userId);
    return {
      rank: entry.rank,
      userId: entry.userId,
      riderName: nameFor(entry.userId),
      ageCategory: info?.ageCategory ?? null,
      city: info?.city ?? null,
      score: entry.score,
      bestTrickScore: entry.bestTrickScore,
      pointsAwarded: entry.pointsAwarded,
    };
  };

  const runs = await db
    .select({
      id: eventRuns.id,
      userId: eventRuns.userId,
      divisionId: eventRuns.divisionId,
      sequence: eventRuns.sequence,
      status: eventRuns.status,
    })
    .from(eventRuns)
    .where(eq(eventRuns.eventId, eventId));
  const scores = await db
    .select({
      runId: eventScores.runId,
      total: eventScores.total,
      scores: eventScores.scores,
      bestTrickTotal: eventScores.bestTrickTotal,
    })
    .from(eventScores)
    .where(eq(eventScores.eventId, eventId));

  // Best-trick boards always come from the panel scores.
  const bestTrickBoards = new Map<string, DivisionStandings["bestTricks"]>();
  for (const division of divisions.filter((candidate) => candidate.hasBestTrick)) {
    const divisionRuns = runs.filter((run) => run.divisionId === division.id);
    const ranked = rankBestTricks(
      divisionRuns.map((run) => {
        const totals = scores
          .filter((score) => score.runId === run.id && score.bestTrickTotal !== null)
          .map((score) => Number(score.bestTrickTotal));
        return {
          runId: run.id,
          userId: run.userId,
          judgeTotals: [],
          judgeScores: [],
          bestTrickTotals: totals.length > 0 ? totals : undefined,
          order: run.sequence,
        };
      }),
    );
    bestTrickBoards.set(
      division.id,
      ranked.map((entry) => ({ rank: entry.rank, userId: entry.userId, riderName: nameFor(entry.userId), score: entry.score })),
    );
  }

  if (published) {
    const results = await db
      .select({
        divisionId: eventResults.divisionId,
        userId: eventResults.userId,
        rank: eventResults.rank,
        totalScore: eventResults.totalScore,
        bestTrickScore: eventResults.bestTrickScore,
        pointsAwarded: eventResults.pointsAwarded,
      })
      .from(eventResults)
      .where(eq(eventResults.eventId, eventId))
      .orderBy(eventResults.rank);
    return {
      eventId,
      published: true,
      divisions: divisions.map((division) => ({
        divisionId: division.id,
        label: labelFor(division),
        format: division.format,
        hasBestTrick: division.hasBestTrick,
        rows: results
          .filter((result) => result.divisionId === division.id)
          .map((result) =>
            row({
              rank: result.rank,
              userId: result.userId,
              score: Number(result.totalScore),
              bestTrickScore: result.bestTrickScore === null ? null : Number(result.bestTrickScore),
              pointsAwarded: result.pointsAwarded,
            }),
          ),
        bestTricks: bestTrickBoards.get(division.id) ?? [],
      })),
    };
  }

  const ranked = rankContestDivisions(divisions, runs, scores);
  return {
    eventId,
    published: false,
    divisions: divisions.map((division) => ({
      divisionId: division.id,
      label: labelFor(division),
      format: division.format,
      hasBestTrick: division.hasBestTrick,
      rows: ranked
        .filter((entry) => entry.divisionId === division.id)
        .map((entry) => row({ ...entry, pointsAwarded: null })),
      bestTricks: bestTrickBoards.get(division.id) ?? [],
    })),
  };
}

/** Published standings of a public contest: shared by every visitor. */
async function getPublicPublishedStandings(eventId: string): Promise<ContestStandings> {
  "use cache: remote";
  cacheTag(`events:item:${eventId}`);
  cacheLife(ITEM_CACHE_LIFE);
  return withDbRead("league.publicStandings", () => loadStandingsData(eventId, true));
}

/**
 * Standings for a viewer. Null when the viewer may not see them (guests on
 * unlisted or unpublished contests, non-members before publishing).
 */
export async function getContestStandings(
  eventId: string,
  viewerId: string | null,
): Promise<ContestStandings | null> {
  const { db } = getDbClient();
  const meta = await withDbRead("league.standingsMeta", async () => {
    const [event] = await db
      .select({
        visibility: sportEvents.visibility,
        publishedAt: sportEvents.resultsPublishedAt,
        isMember: viewerId
          ? sql<boolean>`exists(select 1 from ${eventMemberships} where ${and(
              eq(eventMemberships.eventId, sportEvents.id),
              eq(eventMemberships.userId, viewerId),
              eq(eventMemberships.status, "active"),
            )})`
          : sql<boolean>`false`,
      })
      .from(sportEvents)
      .where(eq(sportEvents.id, eventId))
      .limit(1);
    return event ?? null;
  });
  if (!meta) return null;
  const published = Boolean(meta.publishedAt);
  if (published && meta.visibility === "public") return getPublicPublishedStandings(eventId);
  if (!canSeeStandings({ published, visibility: meta.visibility, isMember: Boolean(meta.isMember) })) {
    return null;
  }
  return withDbRead("league.standings", () => loadStandingsData(eventId, published));
}

// ---------- global League ranking ----------

export interface LeagueRankingFilters {
  discipline?: string;
  format?: string;
  country?: string;
}

export interface LeagueRankingRow {
  position: number;
  userId: string;
  riderName: string;
  points: number;
  contests: number;
  wins: number;
}

export const LEAGUE_RANKING_LIMIT = 50;

async function runListLeagueRanking(filters: LeagueRankingFilters): Promise<LeagueRankingRow[]> {
  const { db } = getDbClient();
  const conditions: SQL[] = [];
  // Discipline / format filters count only division rank bonuses (attendance
  // rows are contest-wide); the country filter applies to every row.
  if (filters.discipline) conditions.push(eq(eventPointsLedger.disciplineSlug, filters.discipline));
  if (filters.format) conditions.push(eq(eventPointsLedger.format, filters.format));
  if (filters.country) conditions.push(eq(eventPointsLedger.countryCode, filters.country));
  const rows = await withDbRead("league.ranking", () =>
    db
      .select({
        userId: eventPointsLedger.userId,
        riderName: profiles.displayName,
        points: sql<number>`sum(${eventPointsLedger.points})::int`,
        contests: sql<number>`count(distinct ${eventPointsLedger.eventId})::int`,
        wins: sql<number>`count(*) filter (where ${eventPointsLedger.rank} = 1)::int`,
      })
      .from(eventPointsLedger)
      .leftJoin(profiles, eq(profiles.id, eventPointsLedger.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(eventPointsLedger.userId, profiles.displayName)
      .orderBy(desc(sql`sum(${eventPointsLedger.points})`), eventPointsLedger.userId)
      .limit(LEAGUE_RANKING_LIMIT),
  );
  return rows.map((entry, index) => ({
    position: index + 1,
    userId: entry.userId,
    riderName: entry.riderName ?? `Rider ${entry.userId.slice(0, 6)}`,
    points: Number(entry.points),
    contests: Number(entry.contests),
    wins: Number(entry.wins),
  }));
}

/** Top riders by league points, cached per filter set. */
export async function listLeagueRanking(filters: LeagueRankingFilters = {}): Promise<LeagueRankingRow[]> {
  "use cache: remote";
  cacheTag("ranking:global");
  cacheLife(LIST_CACHE_LIFE);
  return runListLeagueRanking(filters);
}

/** A rider's published results in one contest, used by the result card. */
export async function getRiderContestResults(
  eventId: string,
  userId: string,
): Promise<{ divisionId: string; label: string; rank: number; score: number; bestTrickScore: number | null; pointsAwarded: number }[]> {
  const { db } = getDbClient();
  return withDbRead("league.riderResults", async () => {
    const rows = await db
      .select({
        divisionId: eventResults.divisionId,
        disciplineSlug: eventDivisions.disciplineSlug,
        format: eventDivisions.format,
        hasBestTrick: eventDivisions.hasBestTrick,
        sortOrder: eventDivisions.sortOrder,
        rank: eventResults.rank,
        totalScore: eventResults.totalScore,
        bestTrickScore: eventResults.bestTrickScore,
        pointsAwarded: eventResults.pointsAwarded,
      })
      .from(eventResults)
      .innerJoin(eventDivisions, eq(eventDivisions.id, eventResults.divisionId))
      .where(and(eq(eventResults.eventId, eventId), eq(eventResults.userId, userId)))
      .orderBy(eventDivisions.sortOrder);
    return rows.map((entry) => ({
      divisionId: entry.divisionId,
      label: labelFor({ id: entry.divisionId, disciplineSlug: entry.disciplineSlug, format: entry.format, hasBestTrick: entry.hasBestTrick, sortOrder: entry.sortOrder }),
      rank: entry.rank,
      score: Number(entry.totalScore),
      bestTrickScore: entry.bestTrickScore === null ? null : Number(entry.bestTrickScore),
      pointsAwarded: entry.pointsAwarded,
    }));
  });
}

/** Who may see a contest's standings (published public → anyone). */
export function canSeeStandings(input: {
  published: boolean;
  visibility: string;
  isMember: boolean;
}): boolean {
  if (input.published && input.visibility === "public") return true;
  return input.isMember;
}
