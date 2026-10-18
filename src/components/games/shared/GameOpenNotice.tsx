"use client";

import { useUIStore } from "@/stores/ui-store";
import Link from "next/link";

export function GameOpenNotice({ gameId, status }: { gameId: string; status: "lobby" | "active" }) {
  const openPreferences = useUIStore((state) => state.openPreferences);

  return (
    <>
      <div className="min-h-[calc(100vh-8rem)] px-5 py-12 md:px-16 md:py-16">
        <div className="mx-auto max-w-3xl border-t-2 border-on-surface pt-6">
           <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            Open match detected
          </p>
          <h1 className="mt-6 max-w-2xl font-display text-6xl font-bold uppercase leading-none tracking-[-0.04em] md:text-8xl">
            Finish your current game first.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-on-surface-variant">
            You already have an open {status === "lobby" ? "lobby" : "match"}.
            Return to it before starting another game.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
           <Link href={`/games/${gameId}`} className="inline-flex min-h-12 items-center rounded-[8px] bg-on-surface px-6 font-display text-sm font-bold uppercase tracking-[0.08em] text-surface transition-colors hover:bg-inverse-surface">
              Return to game
            </Link>
              <button type="button" onClick={openPreferences} className="min-h-12 rounded-[8px] border border-on-surface px-4 font-display text-xs font-bold uppercase tracking-[0.08em] transition-colors hover:bg-surface-container">
              Change sport
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
