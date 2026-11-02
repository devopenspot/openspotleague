"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Trophy, GraduationCap, Flame, Clock } from "lucide-react";
import {
  PROFILE_BODY_CLASS,
  PROFILE_BUTTON_CLASS,
  PROFILE_BUTTON_PRIMARY_CLASS,
  PROFILE_EYEBROW_CLASS,
  PROFILE_SEGMENTS_CLASS,
  profileSegmentClass,
} from "@/components/profile/profile-styles";
import type { ProfileGame } from "@/lib/services/profile/profile";

type Mode = "training" | "challenge";

function GameCard({ game }: { game: ProfileGame }) {
  const isTraining = game.mode === "training";
  return (
    <Link
      href={`/games/${game.id}`}
      className="flex items-center gap-2.5 rounded-lg border-2 border-outline-variant bg-surface-container-lowest p-3 transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${isTraining ? "border-outline-variant bg-surface-container" : "border-primary bg-primary text-on-primary"}`}
      >
        {isTraining ? <GraduationCap size={15} /> : <Trophy size={15} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-bold uppercase leading-none tracking-[0.04em] text-on-surface">
            {isTraining ? "Training" : "Challenge"}
          </span>
          <span className="rounded-md bg-surface-container-high px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
            {game.disciplineSlug}
          </span>
          {game.isWinner ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-primary">
              <Flame size={12} /> Won
            </span>
          ) : null}
        </div>
        <div
          className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 ${PROFILE_EYEBROW_CLASS}`}
        >
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {new Date(game.updatedAt).toLocaleDateString()}
          </span>
          <span>• {game.status}</span>
          <span>• {game.opponents} rivals</span>
          <span>• {game.role}</span>
        </div>
      </div>
      <span className="shrink-0 font-display text-sm font-bold uppercase tracking-[0.04em] text-primary">
        Open
      </span>
    </Link>
  );
}

function GameCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-2.5 rounded-lg border-2 border-outline-variant bg-surface-container-lowest p-3"
    >
      <div className="h-9 w-9 shrink-0 rounded-md bg-surface-container-high" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-20 rounded bg-surface-container-high" />
          <div className="h-6 w-16 rounded-md bg-surface-container-high" />
        </div>
        <div className="h-4 max-w-48 rounded bg-surface-container-high" />
      </div>
      <div className="h-4 w-10 rounded bg-surface-container-high shrink-0" />
    </div>
  );
}

export function ProfileGamesListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="space-y-2 ">
      {Array.from({ length: count }).map((_, i) => (
        <GameCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileGamesList() {
  const [mode, setMode] = useState<Mode>("challenge");
  const [items, setItems] = useState<readonly ProfileGame[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bumped on every load; responses from a superseded load are discarded so a
  // quick mode switch can never append stale results into the newer list.
  const loadGenerationRef = useRef(0);

  const load = async (reset = false) => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ mode, limit: "10" });
      if (!reset && cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/profile/games?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        items: readonly ProfileGame[];
        nextCursor: string | null;
      };
      if (generation !== loadGenerationRef.current) return;
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
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

  return (
    <div className="space-y-3" aria-busy={loading && items.length === 0}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={PROFILE_EYEBROW_CLASS}>Your sessions</h3>
        <div className={PROFILE_SEGMENTS_CLASS}>
          <button
            type="button"
            onClick={() => setMode("challenge")}
            aria-pressed={mode === "challenge"}
            className={profileSegmentClass(mode === "challenge")}
          >
            Challenges
          </button>
          <button
            type="button"
            onClick={() => setMode("training")}
            aria-pressed={mode === "training"}
            className={profileSegmentClass(mode === "training")}
          >
            Trainings
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <ProfileGamesListSkeleton count={4} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-5 text-center">
          <p className="font-display text-sm font-bold uppercase tracking-[0.04em]">
            No {mode}s yet
          </p>
          <p className={`mt-1 ${PROFILE_BODY_CLASS}`}>
            Start your first {mode} from League
          </p>
          <Link
            href="/games"
            className={`mt-3 ${PROFILE_BUTTON_PRIMARY_CLASS}`}
          >
            Go to League
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
          {loading ? <ProfileGamesListSkeleton count={2} /> : null}
        </div>
      )}

      {error ? (
        <p className="text-sm font-semibold leading-5 text-error">
          Couldn’t load sessions
        </p>
      ) : null}

      <div className="flex min-h-12 justify-center">
        {cursor ? (
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className={`${PROFILE_BUTTON_CLASS} disabled:opacity-50`}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : items.length > 0 ? (
          <span
            className={`inline-flex min-h-12 items-center ${PROFILE_EYEBROW_CLASS}`}
          >
            You’re all caught up
          </span>
        ) : null}
      </div>
    </div>
  );
}
