"use client";

import { PROFILE_EYEBROW_CLASS } from "@/components/profile/profile-styles";
import type { ProfileSummary } from "@/lib/services/profile/profile";

const STAT_BUTTON_CLASS =
  "rounded-lg text-left transition-transform active:translate-y-px focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2";
const INFO_TILE_CLASS =
  "rounded-[12px] border border-outline-variant bg-surface-container px-2 py-2.5";

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
    <div className="flex min-h-[92px] flex-col items-center justify-center rounded-lg border-2 border-outline-variant bg-surface-container-lowest px-2.5 py-3 text-center">
      <span className="font-display text-2xl font-bold leading-none text-on-surface">
        {value}
      </span>
      <span className={`mt-1.5 ${PROFILE_EYEBROW_CLASS}`}>{label}</span>
      {actionLabel ? (
        <span className={`mt-0.5 ${PROFILE_EYEBROW_CLASS}`}>{actionLabel}</span>
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
          className={STAT_BUTTON_CLASS}
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
          className={STAT_BUTTON_CLASS}
        >
          <StatCard value={stats.gamesWon} label="Won" />
        </button>
        <button
          type="button"
          onClick={() => onSelectTab?.("tricks")}
          className={STAT_BUTTON_CLASS}
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
          className={STAT_BUTTON_CLASS}
        >
          <StatCard
            value={counts.verified}
            label="Verified"
            actionLabel={`${counts.visited} visited`}
          />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center sm:gap-2.5">
        <div className={INFO_TILE_CLASS}>
          <div className={PROFILE_EYEBROW_CLASS}>Saved</div>
          <div className="mt-1 font-display text-base font-bold leading-none">
            {counts.saved}
          </div>
        </div>
        <div className={INFO_TILE_CLASS}>
          <div className={PROFILE_EYEBROW_CLASS}>Visited</div>
          <div className="mt-1 font-display text-base font-bold leading-none">
            {counts.visited}
          </div>
        </div>
        <div className={INFO_TILE_CLASS}>
          <div className={PROFILE_EYEBROW_CLASS}>Points</div>
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
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5 ">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[92px] rounded-lg bg-surface-container-high"
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-[58px] rounded-[12px] bg-surface-container-high"
          />
        ))}
      </div>
    </div>
  );
}
