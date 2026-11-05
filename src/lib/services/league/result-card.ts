/**
 * Data for a rider's shareable result card (`/league/[slug]/r/[userId]`):
 * the contest, the rider's name and their published result per division.
 * Same visibility as the standings: public contests for everyone, unlisted
 * ones for active members only; nothing before results are published.
 */
import "server-only";
import { getContestDetailBySlug } from "@/lib/services/league";
import { getContestStandings, getRiderContestResults } from "@/lib/services/league/standings";

export interface RiderResultCard {
  contest: { id: string; slug: string; name: string; image: string; visibility: string; dateRangeLabel: string; place: string };
  rider: { userId: string; name: string };
  results: Awaited<ReturnType<typeof getRiderContestResults>>;
}

export async function getRiderResultCard(
  slug: string,
  riderUserId: string,
  viewerId: string | null,
): Promise<RiderResultCard | null> {
  const detail = await getContestDetailBySlug(slug, viewerId);
  if (!detail) return null;
  const contest = detail.contest;
  const standings = await getContestStandings(contest.id, viewerId);
  if (!standings?.published) return null;
  const row = standings.divisions.flatMap((division) => division.rows).find((entry) => entry.userId === riderUserId);
  if (!row) return null;
  const results = await getRiderContestResults(contest.id, riderUserId);
  if (results.length === 0) return null;
  return {
    contest: {
      id: contest.id,
      slug: contest.slug,
      name: contest.name,
      image: contest.image,
      visibility: contest.visibility,
      dateRangeLabel: contest.dateRangeLabel,
      place: [contest.location.city, contest.location.country].filter(Boolean).join(", "),
    },
    rider: { userId: riderUserId, name: row.riderName },
    results,
  };
}
