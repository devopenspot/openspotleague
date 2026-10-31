"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ResumableGame } from "@/components/games/hooks/useMyGames";

export function ResumeGameCard({ game }: { game: ResumableGame }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="flex min-h-[72px] items-center justify-between gap-3 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 py-3 text-on-surface focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
    >
      <span className="min-w-0">
        <span className="block font-display text-lg font-bold leading-tight">
          Resume Game
        </span>
        <span className="block truncate text-sm font-semibold text-on-surface-variant">
          {game.gameName} ·{" "}
          {game.status === "lobby" ? "Waiting in the lobby" : "In progress"}
        </span>
      </span>
      <ArrowRight size={24} aria-hidden="true" className="shrink-0" />
    </Link>
  );
}
