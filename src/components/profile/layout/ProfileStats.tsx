"use client";

import { ChevronRight } from "lucide-react";
import { META } from "@/components/ui/recipes";
import type { ProfileSummary } from "@/lib/services/profile/profile";
import type { TabId } from "@/components/profile/tabs/profile-tabs";
import { formatCount, percent } from "@/components/profile/format";

const JUMP_TILE =
  "group flex min-w-0 flex-col rounded-card border border-outline-variant bg-surface-container-lowest px-3 py-3 text-left transition-[border-color,background-color,transform] duration-150 ease-out hover:border-outline hover:bg-surface-container-low active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function JumpTile({
  label,
  value,
  detail,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={JUMP_TILE}>
      <span className={`flex items-center justify-between gap-1 ${META}`}>
        {label}
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </span>
      <span className="mt-2 font-display text-2xl font-bold leading-none tabular-nums text-on-surface">
        {formatCount(value)}
      </span>
      <span className="mt-1 truncate text-xs leading-tight text-on-surface-variant">{detail}</span>
    </button>
  );
}

/**
 * One tile per tab that has a count behind it. Each fact appears once on the
 * page: points and streak sit in the hero, League numbers in the League card.
 */
export function ProfileStats({
  summary,
  onSelectTab,
}: {
  summary: ProfileSummary;
  onSelectTab: (tab: TabId) => void;
}) {
  const { stats, counts } = summary;
  const tricksTotal = stats.tricksLanded + stats.tricksFailed;

  return (
    <nav aria-label="Profile totals" className="grid grid-cols-3 gap-2 sm:gap-2.5">
      <JumpTile
        label="Games"
        value={stats.gamesPlayed}
        detail={stats.gamesPlayed === 0 ? "Play your first" : `${percent(stats.gamesWon, stats.gamesPlayed)}% won`}
        onClick={() => onSelectTab("games")}
      />
      <JumpTile
        label="Tricks"
        value={stats.tricksLanded}
        detail={tricksTotal === 0 ? "None landed yet" : `${percent(stats.tricksLanded, tricksTotal)}% landed`}
        onClick={() => onSelectTab("tricks")}
      />
      <JumpTile
        label="Spots"
        value={counts.saved}
        detail={`saved · ${formatCount(counts.verified)} verified`}
        onClick={() => onSelectTab("spots")}
      />
    </nav>
  );
}

export function ProfileStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-[86px] rounded-card bg-surface-container-high" />
      ))}
    </div>
  );
}
