"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Overlay } from "@/components/feedback/Overlay";
import { showToast } from "@/hooks/ui/useToast";
import { buildAwardResult } from "@/lib/games/award-result";
import { AwardResultsTable } from "@/components/games/award/AwardResultsTable";
import type { GameHistoryResponse, GameState } from "@/lib/schemas/game";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  game: GameState;
  history?: GameHistoryResponse | null;
};

export function AwardDialog({ isOpen, onClose, game, history }: Props) {
  const router = useRouter();
  const result = useMemo(() => buildAwardResult(game, history ?? null), [game, history]);

  async function handleShare() {
    const url = typeof window !== "undefined"
      ? `${window.location.origin}/games/${game.id}${game.shareCode ? `?share=${encodeURIComponent(game.shareCode)}` : ""}`
      : `/games/${game.id}`;
    const title = result.copy.headline;
    const text = `${result.copy.badge} — ${result.disciplineSlug} · OpenSpot`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as unknown as { share: (data: { title: string; text: string; url: string }) => Promise<void> }).share({ title, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && (navigator as Navigator & { clipboard?: { writeText: (t: string) => Promise<void> } }).clipboard) {
        await (navigator as Navigator & { clipboard: { writeText: (t: string) => Promise<void> } }).clipboard.writeText(url);
        showToast("Link copied — share your session!", "success");
        return;
      }
      showToast("Share failed — link copied instead", "info");
    } catch {
      showToast("Share failed — link copied instead", "info");
    }
  }

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="award-dialog-title"
      describedBy="award-dialog-subtitle"
      role="dialog"
      containerClassName="z-[1300]"
      panelClassName="max-w-2xl w-[min(42rem,calc(100vw-1rem))] overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest shadow-lg"
    >
      <div className="flex flex-col">
        <div className="relative h-40 overflow-hidden rounded-t-[16px] bg-surface-container md:h-48">
          <Image
            src={result.image.src}
            alt={result.image.alt}
            fill
            sizes="(min-width: 768px) 42rem, calc(100vw - 2rem)"
            unoptimized
            className="object-cover object-[center_30%]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-inverse-surface/45" />
          <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-on-primary">
            {result.copy.badge}
          </span>
          <span className="absolute bottom-3 left-4 rounded-full bg-surface-container-high/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] backdrop-blur">
            {result.disciplineSlug} · {result.mode}
          </span>
        </div>

        <div className="space-y-4 p-5 md:p-6">
          <header className="space-y-1">
            <h2 id="award-dialog-title" className="font-display text-xl font-bold leading-tight">
              {result.copy.headline}
            </h2>
            <p id="award-dialog-subtitle" className="text-sm text-on-surface-variant">
              {result.copy.sub}
            </p>
          </header>

          <AwardResultsTable result={result} />

          {history?.nextRoundCursor && (
            <p className="rounded-[12px] border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              Showing 50 of 50+ rounds —{" "}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/games/${game.id}`);
                }}
                className="font-semibold underline underline-offset-4"
              >
                view full board
              </button>
            </p>
          )}

          {result.ranking.length === 0 && result.soloRow === null && !history?.nextRoundCursor && (
            <p className="rounded-[16px] border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
              No rounds were settled — the crew headed out before a line was set.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-lowest p-4 md:p-5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full border border-outline-variant bg-surface-container-lowest px-5 font-display text-xs font-bold uppercase tracking-[0.05em]"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/games/${game.id}`);
            }}
            className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-bold uppercase tracking-[0.05em]"
          >
            View board
          </button>
          {game.shareCode && (
            <button
              type="button"
              onClick={() => void handleShare()}
              className="min-h-11 rounded-full bg-primary px-5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary"
            >
              Share
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}
