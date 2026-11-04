"use client";

import { UserAvatar } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { BODY, CARD, META, tagClass } from "@/components/ui/recipes";
import type { ProfileSummary } from "@/lib/services/profile/profile";

export function ProfileHero({ summary }: { summary: ProfileSummary }) {
  const { user, rank, totalPoints, nextRank, progress, streakDays } = summary;
  const initials = user.initials || user.name.slice(0, 2).toUpperCase() || "OS";
  const displayName = user.name || user.email.split("@")[0] || "Rider";

  return (
    <div className={`relative overflow-hidden ${CARD}`}>
      <div className="flex items-start gap-3 sm:gap-3.5">
        <UserAvatar
          user={{ name: displayName, initials, avatarUrl: null }}
          size="lg"
          className="h-12 w-12 text-sm sm:h-14 sm:w-14"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="max-w-full truncate font-display text-2xl font-bold uppercase leading-tight tracking-display text-on-surface">
              {displayName}
            </h1>
            {streakDays >= 2 ? (
              <span className={tagClass("solid")}>
                🔥 {streakDays}d streak
              </span>
            ) : null}
          </div>
          <p className={`truncate ${BODY}`}>{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{rank}</Badge>
            <span className={META}>{totalPoints} pts</span>
          </div>
        </div>
      </div>

      {/* progress to next rank */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`shrink-0 ${META}`}>
            Level progress
          </span>
          <span className={`truncate ${META}`}>
            {nextRank
              ? `${nextRank.pointsNeeded} to ${nextRank.label}`
              : "Max rank!"}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to next rank"
          />
        </div>
        <p className={`mt-1.5 ${BODY}`}>
          {nextRank
            ? `Keep riding to unlock ${nextRank.label}`
            : "Top rank — stay legendary"}
        </p>
      </div>
    </div>
  );
}

export function ProfileHeroSkeleton() {
  return (
    <div className={CARD}>
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-full bg-surface-container-high sm:h-14 sm:w-14" />
        <div className="min-w-0 flex-1">
          <div className="h-8 w-40 max-w-full rounded bg-surface-container-high" />
          <div className="h-5 w-44 max-w-full rounded bg-surface-container-high" />
          <div className="mt-2 h-7 w-32 rounded-control bg-surface-container-high" />
        </div>
      </div>
      <div className="mt-4 h-4 w-full rounded bg-surface-container-high" />
      <div className="mt-1.5 h-1.5 rounded-full bg-surface-container-high" />
      <div className="mt-1.5 h-5 w-52 max-w-full rounded bg-surface-container-high" />
    </div>
  );
}
