"use client"

import { UserAvatar } from "@/components/ui"
import { Badge } from "@/components/ui/Badge"
import type { ProfileSummary } from "@/lib/services/profile/profile"

export function ProfileHero({ summary }: { summary: ProfileSummary }) {
  const { user, rank, totalPoints, nextRank, progress, streakDays } = summary
  const initials = user.initials || user.name.slice(0, 2).toUpperCase() || "OS"
  const displayName = user.name || user.email.split("@")[0] || "Rider"

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4">
      <div className="flex items-start gap-3 sm:gap-3.5">
        <UserAvatar user={{ name: displayName, initials, avatarUrl: null }} size="lg" className="h-12 w-12 text-[13px] sm:h-14 sm:w-14 sm:text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="truncate font-display text-[17px] font-bold uppercase tracking-tight text-on-surface sm:text-lg">{displayName}</h1>
            {streakDays >= 2 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-on-primary">
                🔥 {streakDays}d streak
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate font-display text-[11px] tracking-wide text-secondary">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="accent" className="rounded-full px-2.5 py-0.5 text-[11px]">{rank}</Badge>
            <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-secondary">{totalPoints} pts</span>
          </div>
        </div>
      </div>

      {/* progress to next rank */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">Level progress</span>
          <span className="truncate font-display text-[10px] uppercase tracking-widest text-secondary">
            {nextRank ? `${nextRank.pointsNeeded} to ${nextRank.label}` : "Max rank!"}
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
        <p className="mt-1.5 font-display text-[10px] uppercase tracking-widest text-secondary">
          {nextRank ? `Keep riding to unlock ${nextRank.label}` : "Top rank — stay legendary"}
        </p>
      </div>
    </div>
  )
}

export function ProfileHeroSkeleton() {
  return (
    <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 animate-pulse">
      <div className="flex gap-3">
        <div className="h-12 w-12 rounded-full bg-surface-container-high sm:h-14 sm:w-14" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-28 rounded bg-surface-container-high" />
          <div className="h-3 w-44 rounded bg-surface-container-high" />
          <div className="h-5 w-24 rounded-full bg-surface-container-high" />
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-surface-container-high" />
      <div className="mt-2 h-3 w-36 rounded bg-surface-container-high" />
    </div>
  )
}
