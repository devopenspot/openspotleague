/**
 * League activity for the profile: days a rider submitted a video or rode
 * a live window (activity, 0 points) and league points on the day they were
 * awarded, plus a short contest history. Reads only; no imports from the
 * league writers so profile reads stay cycle-free.
 */
import "server-only";
import { and, desc, eq, gte, isNotNull, or } from "drizzle-orm";
import { getDbClient, withDbRead } from "@/lib/db/client";
import { eventDivisions, eventPointsLedger, eventResults, eventRuns, sportEvents } from "@/db/schema";
import { divisionLabel, isRatingDiscipline, type ContestFormat } from "@/lib/league/rating/formats";

export interface ActivityEvent {
  createdAt: Date;
  points: number;
}

export async function loadLeagueActivityEvents(userId: string, start: Date): Promise<ActivityEvent[]> {
  const { db } = getDbClient();
  const [runs, ledger] = await Promise.all([
    withDbRead("league.activity.runs", () =>
      db
        .select({ videoSubmittedAt: eventRuns.videoSubmittedAt, windowStartedAt: eventRuns.windowStartedAt })
        .from(eventRuns)
        .where(
          and(
            eq(eventRuns.userId, userId),
            or(gte(eventRuns.videoSubmittedAt, start), gte(eventRuns.windowStartedAt, start)),
          ),
        ),
    ),
    withDbRead("league.activity.points", () =>
      db
        .select({ createdAt: eventPointsLedger.createdAt, points: eventPointsLedger.points })
        .from(eventPointsLedger)
        .where(and(eq(eventPointsLedger.userId, userId), gte(eventPointsLedger.createdAt, start))),
    ),
  ]);
  const rode = runs.flatMap((run) => {
    const when = run.videoSubmittedAt ?? run.windowStartedAt;
    return when && when >= start ? [{ createdAt: when, points: 0 }] : [];
  });
  return [...rode, ...ledger];
}

export interface LeagueHistoryItem {
  contestName: string;
  contestSlug: string;
  divisionLabel: string;
  rank: number;
  pointsAwarded: number;
  publishedAt: string;
}

/** Latest published results for a rider, newest first. */
export async function listLeagueHistory(userId: string, limit = 8): Promise<LeagueHistoryItem[]> {
  const { db } = getDbClient();
  const rows = await withDbRead("league.history", () =>
    db
      .select({
        contestName: sportEvents.name,
        contestSlug: sportEvents.slug,
        disciplineSlug: eventDivisions.disciplineSlug,
        format: eventDivisions.format,
        rank: eventResults.rank,
        pointsAwarded: eventResults.pointsAwarded,
        publishedAt: eventResults.publishedAt,
      })
      .from(eventResults)
      .innerJoin(sportEvents, eq(sportEvents.id, eventResults.eventId))
      .innerJoin(eventDivisions, eq(eventDivisions.id, eventResults.divisionId))
      .where(and(eq(eventResults.userId, userId), isNotNull(sportEvents.resultsPublishedAt)))
      .orderBy(desc(eventResults.publishedAt))
      .limit(limit),
  );
  return rows.map((row) => ({
    contestName: row.contestName,
    contestSlug: row.contestSlug,
    divisionLabel: isRatingDiscipline(row.disciplineSlug)
      ? divisionLabel(row.disciplineSlug, row.format as ContestFormat)
      : row.disciplineSlug,
    rank: row.rank,
    pointsAwarded: row.pointsAwarded,
    publishedAt: row.publishedAt.toISOString(),
  }));
}
