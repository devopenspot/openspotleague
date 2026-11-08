import { UserAvatar } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { CARD, META, tagClass } from "@/components/ui/recipes";
import type { ProfileSummary } from "@/lib/services/profile/profile";
import { formatCount } from "@/components/profile/format";

/**
 * Identity and rank: who you are, where you stand, how far to the next rank.
 * Points and the current streak live here only; email lives in Account.
 */
export function ProfileHero({ summary }: { summary: ProfileSummary }) {
  const { user, rank, totalPoints, nextRank, progress, streakDays } = summary;
  const displayName = user.name || user.email.split("@")[0] || "Rider";
  const initials = user.initials || displayName.slice(0, 2).toUpperCase() || "OS";
  const percent = Math.round(progress * 100);

  return (
    <section className={CARD} aria-label="Rider card">
      <div className="flex items-center gap-3 sm:gap-4">
        <UserAvatar
          user={{ name: displayName, initials, avatarUrl: null }}
          size="lg"
          className="h-14 w-14 text-base"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold uppercase leading-tight tracking-display text-on-surface">
            {displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{rank}</Badge>
            <span className={`${META} tabular-nums`}>{formatCount(totalPoints)} pts</span>
            {streakDays >= 2 ? (
              <span className={tagClass("solid")} title="Days in a row with activity">
                🔥 {streakDays}-day streak
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={nextRank ? `Progress to ${nextRank.label}` : "Top rank reached"}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className={`mt-1.5 ${META} tabular-nums`}>
          {nextRank
            ? `${formatCount(nextRank.pointsNeeded)} pts to ${nextRank.label}`
            : "Top rank reached"}
        </p>
      </div>
    </section>
  );
}

export function ProfileHeroSkeleton() {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="h-14 w-14 shrink-0 rounded-full bg-surface-container-high" />
        <div className="min-w-0 flex-1">
          <div className="h-8 w-40 max-w-full rounded bg-surface-container-high" />
          <div className="mt-1.5 h-6 w-44 max-w-full rounded-control bg-surface-container-high" />
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-surface-container-high" />
      <div className="mt-1.5 h-4 w-36 rounded bg-surface-container-high" />
    </div>
  );
}
