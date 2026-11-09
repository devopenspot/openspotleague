/**
 * League section of the profile Overview: contests ridden and won, and the
 * latest published results, each linking to its shareable result page.
 */
import Link from "next/link";
import { Medal } from "lucide-react";
import { BODY, CARD, CARD_TITLE, LABEL, META, TILE, controlClass } from "@/components/ui/recipes";
import { LEAGUE_RANKING_PATH, buildContestResultUrl } from "@/lib/league/urls";
import { ROUTES } from "@/lib/navigation/nav";
import type { ProfileSummary } from "@/lib/services/profile/profile";

export function ProfileLeagueCard({ summary }: { summary: ProfileSummary }) {
  const history = summary.leagueHistory ?? [];
  const attended = summary.stats.eventsAttended ?? 0;
  const won = summary.stats.eventsWon ?? 0;
  return (
    <section className={CARD} aria-labelledby="profile-league">
      <div className="flex items-center justify-between gap-2">
        <h2 id="profile-league" className={CARD_TITLE}>
          League
        </h2>
        <Link prefetch={false} href={LEAGUE_RANKING_PATH} className={controlClass("outline")}>
          <Medal size={14} aria-hidden="true" /> Ranking
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className={TILE}>
          <p className={META}>Contests</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{attended}</p>
        </div>
        <div className={TILE}>
          <p className={META}>Wins</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums">{won}</p>
        </div>
      </div>
      {history.length === 0 ? (
        <p className={`mt-3 ${BODY}`}>
          Your contest results show up here once organizers publish them.{" "}
          <Link prefetch={false} href={ROUTES.league} className="font-semibold text-on-surface underline">
            Find a contest
          </Link>
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5" aria-label="Recent contest results">
          {history.map((item) => (
            <li key={`${item.contestSlug}-${item.divisionLabel}`}>
              <Link prefetch={false}
                href={buildContestResultUrl(item.contestSlug, summary.user.id)}
                className="flex items-center justify-between gap-3 rounded-inner px-3 py-2 hover:bg-surface-container"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-on-surface">{item.contestName}</span>
                  <span className={LABEL}>{item.divisionLabel}</span>
                </span>
                <span className="text-right">
                  <span className="block font-display text-base font-bold tabular-nums">#{item.rank}</span>
                  <span className={LABEL}>+{item.pointsAwarded} pts</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
