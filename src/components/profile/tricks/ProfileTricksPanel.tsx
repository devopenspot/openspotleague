"use client";

import { BODY, CARD, CARD_TITLE, EYEBROW, META, tagClass } from "@/components/ui/recipes";
import { LEVEL_POINTS, WINNER_BONUS_POINTS } from "@/lib/games/definitions";
import type { TrickLevel } from "@/lib/schemas/game";
import type { ProfileTricksState } from "@/components/profile/hooks/useProfileTricks";
import { formatCount, formatShortDate, percent } from "@/components/profile/format";

const LEVELS: readonly TrickLevel[] = [1, 2, 3, 4, 5];

/** "L1 5 · L2 8 · … · Win +34", always from the game definitions. */
const POINTS_LEGEND = `${LEVELS.map((level) => `L${level} ${LEVEL_POINTS[level]}`).join(" · ")} · Win +${WINNER_BONUS_POINTS} pts`;

function LevelBar({ level, count, max }: { level: TrickLevel; count: number; max: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`w-6 ${META}`}>L{level}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent(count, max)}%` }}
        />
      </div>
      <span className="w-8 text-right font-display text-sm font-bold leading-none tabular-nums">
        {formatCount(count)}
      </span>
    </div>
  );
}

/**
 * `summary` is the Overview preview (totals + level bars, no frame or recent
 * list: it sits inside the Overview card). `full` is the Tricks tab.
 */
export function ProfileTricksPanel({
  state,
  variant = "full",
}: {
  state: ProfileTricksState;
  variant?: "full" | "summary";
}) {
  const summary = variant === "summary";
  if (state.status === "loading") return <ProfileTricksSkeleton variant={variant} />;
  if (state.status === "error") {
    return <p className={BODY}>Tricks are unavailable right now. Try again in a moment.</p>;
  }

  const { data } = state;
  const max = Math.max(1, ...LEVELS.map((level) => data.byLevel[level]));
  const attempts = data.totalLanded + data.totalFailed;

  const levels = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {summary ? null : <h2 className={CARD_TITLE}>Landed by level</h2>}
        <span className={tagClass("neutral")}>
          {formatCount(data.totalLanded)} landed · {formatCount(data.totalFailed)} missed · {percent(data.totalLanded, attempts)}%
        </span>
      </div>
      <div className="mt-3 space-y-2.5" role="list" aria-label="Tricks landed by level">
        {LEVELS.map((level) => (
          <div role="listitem" key={level}>
            <LevelBar level={level} count={data.byLevel[level]} max={max} />
          </div>
        ))}
      </div>
      <p className={`mt-3 ${META}`}>{POINTS_LEGEND}</p>
    </>
  );

  if (summary) return levels;

  return (
    <div className="space-y-4">
      <section className={CARD}>{levels}</section>
      <section className={CARD} aria-labelledby="profile-recent-landings">
        <h2 id="profile-recent-landings" className={EYEBROW}>
          Recent landings
        </h2>
        {data.recent.length === 0 ? (
          <p className={`mt-2.5 ${BODY}`}>No landings yet. Land your first trick in a game.</p>
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {data.recent.map((r, idx) => (
              <li
                key={`${r.date}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-inner border border-outline-variant bg-surface-container-low px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold leading-tight">{r.name}</p>
                  <p className={`mt-1 ${META}`}>
                    L{r.level} · {formatShortDate(r.date)}
                  </p>
                </div>
                <span className={`shrink-0 ${tagClass("solid")}`}>+{r.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function ProfileTricksSkeleton({ variant = "full" }: { variant?: "full" | "summary" }) {
  const levels = (
    <div aria-hidden="true">
      <div className="h-6 w-48 max-w-full rounded-control bg-surface-container-high" />
      <div className="mt-3 space-y-2.5">
        {LEVELS.map((level) => (
          <div key={level} className="flex items-center gap-2.5">
            <div className="h-4 w-6 rounded bg-surface-container-high" />
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high" />
            <div className="h-4 w-8 rounded bg-surface-container-high" />
          </div>
        ))}
      </div>
      <div className="mt-3 h-4 w-56 max-w-full rounded bg-surface-container-high" />
    </div>
  );
  if (variant === "summary") return levels;
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className={CARD}>{levels}</div>
      <div className={CARD}>
        <div className="h-4 w-32 rounded bg-surface-container-high" />
        <div className="mt-2.5 space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-[52px] rounded-inner border border-outline-variant bg-surface-container-low" />
          ))}
        </div>
      </div>
    </div>
  );
}
