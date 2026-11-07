"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { DrawerHeader, SIDE_DRAWER_PANEL } from "@/components/feedback/DrawerParts";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { loadGuestToken, loadOrCreateGuestToken } from "@/lib/games/guest";
import { DISCIPLINE_META, type DisciplineSlug } from "@/lib/games/discipline";
import {
  gameMutationResponseSchema,
  openTrainingGamesResponseSchema,
  type OpenTrainingGame,
} from "@/lib/schemas/game";
import { GAME_STATUS_LABEL } from "@/lib/games/labels";
import { controlClass } from "@/components/ui/recipes";

const DRAWER_TITLE_ID = "open-training-games-title";

export function OpenTrainingGamesDrawer({
  isOpen,
  onClose,
  authenticated,
}: {
  isOpen: boolean;
  onClose: () => void;
  authenticated: boolean;
}) {
  const [games, setGames] = useState<OpenTrainingGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const headers: Record<string, string> = {};
    if (!authenticated) {
      const token = loadOrCreateGuestToken();
      if (token) headers["x-guest-token"] = token;
    }
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/games?mode=training&status=open", {
          headers,
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error(
            (await response.json().catch(() => null))?.error ??
              "Open games could not be loaded.",
          );
        const parsed = openTrainingGamesResponseSchema.safeParse(
          await response.json().catch(() => null),
        );
        if (!parsed.success) throw new Error("Open games could not be loaded.");
        if (!cancelled) setGames(parsed.data);
      } catch (reason) {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "Open games could not be loaded.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, isOpen, reloadKey]);

  async function cancelGame(game: OpenTrainingGame) {
    setCancelingId(game.id);
    setError(null);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (!authenticated) {
      const token = loadGuestToken();
      if (token) headers["x-guest-token"] = token;
    }
    try {
      const response = await fetch(`/api/games/${game.id}/cancel`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          expectedVersion: game.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const rawData = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(rawData?.error ?? "Game could not be closed.");
      if (!gameMutationResponseSchema.safeParse(rawData).success)
        throw new Error("Game could not be closed. Refresh and try again.");
      setGames((current) => current.filter((item) => item.id !== game.id));
      setConfirmingId(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Game could not be closed.",
      );
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={DRAWER_TITLE_ID}
      contentId="open-training-games-drawer"
      testId="open-training-games-drawer"
      panelClassName={SIDE_DRAWER_PANEL}
    >
      <DrawerHeader
        eyebrow="Training games"
        title="Open games"
        titleId={DRAWER_TITLE_ID}
        closeLabel="Close open training games"
        onClose={onClose}
      >
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">
          Resume a lobby or close one to make room for another. Inactive games
          expire after 10 minutes.
        </p>
      </DrawerHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {loading && games.length === 0 ? <LoadingList /> : null}
        {error ? (
          <div
            className="mt-6 border border-on-surface bg-surface-container-low px-4 py-3 text-sm"
            role="alert"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className={`mt-3 ${controlClass("outline")}`}
            >
              Try again
            </button>
          </div>
        ) : null}
        {!loading && games.length === 0 && !error ? (
          <div className="mt-8 border-y border-outline py-6">
            <p className="font-display text-2xl font-bold uppercase">
              No open training games
            </p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">
              Your next training game will appear here while it is open.
            </p>
            <Link
              href="/games"
              onClick={onClose}
              className="mt-5 inline-flex min-h-11 items-center rounded-full bg-on-surface px-4 font-display text-xs font-bold uppercase tracking-[0.08em] text-surface transition-colors hover:bg-inverse-surface"
            >
              Create training game
            </Link>
          </div>
        ) : null}
        <div className="divide-y divide-outline">
          {games.map((game) => {
            const meta = DISCIPLINE_META[game.disciplineSlug as DisciplineSlug];
            const confirming = confirmingId === game.id;
            const canceling = cancelingId === game.id;
            return (
              <article key={game.id} className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl font-bold uppercase">
                      {game.gameName}
                    </p>
                    <p className="mt-1 font-display text-xs uppercase tracking-[0.08em] text-secondary">
                      {meta?.name ?? game.disciplineSlug} / {GAME_STATUS_LABEL[game.status]} /{" "}
                      {game.nextSpotType}
                    </p>
                  </div>
                  <span className="font-display text-xs uppercase tracking-[0.08em] text-secondary">
                    Open
                  </span>
                </div>
                {confirming ? (
                  <div className="mt-4 border border-on-surface bg-surface-container-low p-3">
                    <p className="text-sm text-on-surface-variant">
                      Close this game? Riders in it won&apos;t be able to continue.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void cancelGame(game)}
                        disabled={canceling}
                        className="min-h-11 rounded-full bg-on-surface px-4 font-display text-xs font-bold uppercase tracking-[0.08em] text-surface transition-colors hover:bg-inverse-surface disabled:opacity-50"
                      >
                        {canceling ? "Closing…" : "Yes, Close Game"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={canceling}
                        className="min-h-11 rounded-full border border-outline px-4 font-display text-xs font-bold uppercase tracking-[0.08em] transition-colors hover:bg-surface-container disabled:opacity-50"
                      >
                        Keep Riding
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/games/${game.id}`}
                      onClick={onClose}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-on-surface px-4 font-display text-xs font-bold uppercase tracking-[0.08em] text-surface transition-colors hover:bg-inverse-surface"
                    >
                      Resume <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(game.id)}
                      className="min-h-11 rounded-full border border-outline px-4 font-display text-xs font-bold uppercase tracking-[0.08em] transition-colors hover:border-on-surface hover:bg-surface-container"
                    >
                      Close Game
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </SideDrawer>
  );
}

function LoadingList() {
  return (
    <div className="mt-6 space-y-4" role="status" aria-label="Loading open games">
      <div className="h-20  border-y border-outline" />
      <div className="h-20  border-y border-outline" />
    </div>
  );
}
