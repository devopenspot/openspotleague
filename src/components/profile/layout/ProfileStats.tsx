"use client";

import type { ProfileSummary } from "@/lib/services/profile/profile";

function StatCard({
  value,
  label,
  actionLabel,
}: {
  value: number | string;
  label: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex min-h-[68px] flex-col items-center justify-center rounded-[12px] border border-outline-variant bg-surface-container-lowest px-2.5 py-3 text-center sm:min-h-[72px]">
      <span className="font-display text-xl font-bold leading-none text-on-surface sm:text-[22px]">
        {value}
      </span>
      <span className="mt-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-secondary">
        {label}
      </span>
      {actionLabel ? (
        <span className="mt-0.5 font-display text-[10px] uppercase tracking-widest text-secondary">
          {actionLabel}
        </span>
      ) : null}
    </div>
  );
}

export function ProfileStats({
  summary,
  onSelectTab,
}: {
  summary: ProfileSummary;
  onSelectTab?: (tab: string) => void;
}) {
  const { stats, counts } = summary;
  const winRate =
    stats.gamesPlayed > 0
      ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100)
      : 0;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
        <button
          type="button"
          onClick={() => onSelectTab?.("play")}
          className="rounded-[12px] text-left transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <StatCard
            value={stats.gamesPlayed}
            label="Played"
            actionLabel={
              stats.gamesPlayed === 0 ? "Start now" : `${winRate}% won`
            }
          />
        </button>
        <button
          type="button"
          onClick={() => onSelectTab?.("play")}
          className="rounded-[12px] text-left transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <StatCard value={stats.gamesWon} label="Won" />
        </button>
        <button
          type="button"
          onClick={() => onSelectTab?.("tricks")}
          className="rounded-[12px] text-left transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <StatCard
            value={stats.tricksLanded}
            label="Landed"
            actionLabel={`${stats.tricksFailed} failed`}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelectTab?.("spots")}
          className="rounded-[12px] text-left transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        >
          <StatCard
            value={counts.verified}
            label="Verified"
            actionLabel={`${counts.visited} visited`}
          />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center sm:gap-2.5">
        <div className="rounded-[12px] border border-outline-variant bg-surface-container px-2 py-2.5">
          <div className="font-display text-[10px] font-bold uppercase tracking-widest text-secondary">
            Saved
          </div>
          <div className="mt-1 font-display text-base font-bold leading-none">
            {counts.saved}
          </div>
        </div>
        <div className="rounded-[12px] border border-outline-variant bg-surface-container px-2 py-2.5">
          <div className="font-display text-[10px] font-bold uppercase tracking-widest text-secondary">
            Visited
          </div>
          <div className="mt-1 font-display text-base font-bold leading-none">
            {counts.visited}
          </div>
        </div>
        <div className="rounded-[12px] border border-outline-variant bg-surface-container px-2 py-2.5">
          <div className="font-display text-[10px] font-bold uppercase tracking-widest text-secondary">
            Points
          </div>
          <div className="mt-1 font-display text-base font-bold leading-none">
            {summary.totalPoints}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 ">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[72px] rounded-[12px] bg-surface-container-high"
        />
      ))}
    </div>
  );
}
