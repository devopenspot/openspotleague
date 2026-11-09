"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flame, GraduationCap, Trophy } from "lucide-react";
import { BODY, EMPTY_STATE, META, SEGMENTED_TRACK, controlClass, segmentClass, tagClass } from "@/components/ui/recipes";
import { GAME_MODE_LABEL } from "@/lib/games/labels";
import { matchStatusLabel } from "@/lib/games/match-labels";
import { gameModeSchema, gameStatusSchema, type GameMode } from "@/lib/schemas/game";
import { ROUTES } from "@/lib/navigation/nav";
import type { ProfileGame } from "@/lib/services/profile/profile";
import { disciplineName, formatShortDate, plural } from "@/components/profile/format";

const MODES: readonly GameMode[] = ["challenge", "training"];

function gameLabels(game: ProfileGame): { mode: string; status: string | null; isTraining: boolean } {
  const mode = gameModeSchema.safeParse(game.mode);
  const status = gameStatusSchema.safeParse(game.status);
  if (!mode.success) return { mode: "Game", status: null, isTraining: false };
  return {
    mode: GAME_MODE_LABEL[mode.data],
    status: status.success ? matchStatusLabel({ mode: mode.data, status: status.data }) : null,
    isTraining: mode.data === "training",
  };
}

function GameCard({ game }: { game: ProfileGame }) {
  const labels = gameLabels(game);
  const details = [
    formatShortDate(game.updatedAt),
    labels.status,
    game.opponents > 0 ? `vs ${plural(game.opponents, "rider")}` : "Solo",
    game.role === "creator" ? "You started it" : "You joined",
  ].filter(Boolean);

  return (
    <Link prefetch={false}
      href={`/games/${game.id}`}
      className="group flex items-center gap-3 rounded-inner border border-outline-variant bg-surface-container-lowest p-3 transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:translate-y-px"
    >
      <span
        aria-hidden="true"
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control border ${labels.isTraining ? "border-outline-variant bg-surface-container" : "border-primary bg-primary text-on-primary"}`}
      >
        {labels.isTraining ? <GraduationCap size={15} /> : <Trophy size={15} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-bold uppercase leading-none tracking-dense text-on-surface">
            {labels.mode}
          </span>
          <span className={tagClass("neutral")}>{disciplineName(game.disciplineSlug)}</span>
          {game.isWinner ? (
            <span className={tagClass("solid")}>
              <Flame size={12} aria-hidden="true" /> Won
            </span>
          ) : null}
        </span>
        <span className={`mt-1.5 block truncate ${META}`}>{details.join(" · ")}</span>
      </span>
      <ChevronRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-secondary transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function GameCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3 rounded-inner border border-outline-variant bg-surface-container-lowest p-3"
    >
      <div className="h-9 w-9 shrink-0 rounded-control bg-surface-container-high" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-20 rounded bg-surface-container-high" />
          <div className="h-6 w-16 rounded-control bg-surface-container-high" />
        </div>
        <div className="h-4 max-w-48 rounded bg-surface-container-high" />
      </div>
    </div>
  );
}

export function ProfileGamesListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}

function EmptyGames({ mode }: { mode: GameMode | null }) {
  const noun = mode ? `${GAME_MODE_LABEL[mode].toLowerCase()}s` : "games";
  return (
    <div className={EMPTY_STATE}>
      <p className="font-display text-sm font-bold uppercase tracking-dense">No {noun} yet</p>
      <p className={`mt-1 ${BODY}`}>Start one from Games and it shows up here.</p>
      <Link prefetch={false} href={ROUTES.games} className={`mt-3 ${controlClass("primary")}`}>
        Go to Games
      </Link>
    </div>
  );
}

/**
 * `full` is the Games tab: a Battles/Trainings toggle with Load more.
 * `preview` is the Overview card: the latest few games of any mode, no paging.
 */
export function ProfileGamesList({ variant = "full" }: { variant?: "full" | "preview" }) {
  const preview = variant === "preview";
  const [mode, setMode] = useState<GameMode>("challenge");
  const [items, setItems] = useState<readonly ProfileGame[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Bumped on every load; responses from a superseded load are discarded so a
  // quick mode switch can never append stale results into the newer list.
  const loadGenerationRef = useRef(0);

  const load = async (reset = false) => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: preview ? "3" : "10" });
      if (!preview) params.set("mode", mode);
      if (!reset && cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/profile/games?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        items: readonly ProfileGame[];
        nextCursor: string | null;
      };
      if (generation !== loadGenerationRef.current) return;
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(preview ? null : data.nextCursor);
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setError(true);
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  };

  // Reset list on mode change — intentional synchronous reset before refetch
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems([]);
    setCursor(null);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const list =
    loading && items.length === 0 ? (
      <ProfileGamesListSkeleton count={preview ? 3 : 4} />
    ) : error && items.length === 0 ? (
      <p className={BODY}>
        Couldn’t load your games.{" "}
        <button type="button" onClick={() => void load(true)} className="font-semibold text-on-surface underline">
          Try again
        </button>
      </p>
    ) : items.length === 0 ? (
      <EmptyGames mode={preview ? null : mode} />
    ) : (
      <div className="space-y-2">
        {items.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {loading ? <ProfileGamesListSkeleton count={2} /> : null}
      </div>
    );

  if (preview) return <div aria-busy={loading}>{list}</div>;

  return (
    <div className="space-y-3" aria-busy={loading && items.length === 0}>
      <div className={`sm:max-w-xs ${SEGMENTED_TRACK}`} role="group" aria-label="Game mode">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={segmentClass(mode === m)}
          >
            {GAME_MODE_LABEL[m]}s
          </button>
        ))}
      </div>

      {list}

      {error && items.length > 0 ? (
        <p className="text-sm leading-5 text-error">Couldn’t load more games.</p>
      ) : null}

      {cursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void load(false)}
            disabled={loading}
            className={`${controlClass("outline")} disabled:opacity-50`}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
