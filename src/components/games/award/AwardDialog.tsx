"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X } from "lucide-react";
import { Overlay } from "@/components/feedback/Overlay";
import { showToast } from "@/hooks/ui/useToast";
import { shareOrCopyUrl } from "@/lib/utils/share";
import {
  buildAwardResult,
  ordinal,
  type AwardResultRow,
} from "@/lib/games/award-result";
import {
  AwardResultsTable,
  attemptsLabel,
} from "@/components/games/award/AwardResultsTable";
import {
  CARD_NESTED,
  EMPTY_STATE,
  alertClass,
  controlClass,
  iconButtonClass,
  tagClass,
} from "@/components/ui/recipes";
import type { GameHistoryResponse, GameState } from "@/lib/schemas/game";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  game: GameState;
  history?: GameHistoryResponse | null;
  /**
   * `board`: opened on /games/:id itself — no "View board", 48px session
   * targets. `list`: opened from a match list elsewhere.
   */
  context?: "board" | "list";
};

/** The page-title voice, one step smaller so long rider names fit the dialog. */
const HERO_TITLE =
  "font-display text-2xl font-bold uppercase leading-tight tracking-display text-surface sm:text-3xl";

function ViewerLine({
  row,
  hasWinner,
  size,
}: {
  row: AwardResultRow;
  hasWinner: boolean;
  size: "lg" | "sm";
}) {
  const label = row.isWinner
    ? "You won"
    : hasWinner
      ? `You finished ${ordinal(row.rank)}`
      : `You're ${ordinal(row.rank)} on points`;
  return (
    <p className={`${CARD_NESTED} flex flex-wrap items-center gap-x-3 gap-y-2`}>
      <span className={tagClass(row.isWinner ? "solid" : "neutral", size)}>
        {label}
      </span>
      <span className="text-sm text-on-surface">
        <span className="font-mono font-bold tabular-nums">{row.points}</span> pts ·{" "}
        {attemptsLabel(row)}
      </span>
    </p>
  );
}

export function AwardDialog({
  isOpen,
  onClose,
  game,
  history,
  context = "list",
}: Props) {
  const router = useRouter();
  const result = useMemo(() => buildAwardResult(game, history ?? null), [game, history]);
  const onBoard = context === "board";
  const size = onBoard ? "lg" : "md";
  // Nothing settled and nobody won: standings would be a board of zeros.
  const isEmpty =
    (result.totals.rounds === 0 && result.winner === null) ||
    (result.ranking.length === 0 && result.soloRow === null);
  const viewerRow =
    result.variant === "multiplayer" && !isEmpty
      ? (result.ranking.find((row) => row.isViewer) ?? null)
      : null;
  const canShare = Boolean(game.shareCode);

  function goToBoard() {
    onClose();
    router.push(`/games/${game.id}`);
  }

  async function handleShare() {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/games/${game.id}${game.shareCode ? `?share=${encodeURIComponent(game.shareCode)}` : ""}`
        : `/games/${game.id}`;
    const outcome = await shareOrCopyUrl(url, result.copy.headline);
    if (outcome === "copied") {
      showToast("Link copied — share your session!", "success");
    } else if (outcome === "failed" && !("share" in navigator)) {
      // A dismissed native share sheet also reports "failed": stay quiet then.
      showToast(`Couldn't share. Here's the link: ${url}`, "info");
    }
  }

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="award-dialog-title"
      describedBy="award-dialog-subtitle"
      role="dialog"
    >
      {/* Overlay's panel already sets width/radius defaults that `cn` cannot
          override, so the dialog's own frame lives on this inner wrapper. */}
      <div className="mx-auto flex max-h-[calc(100dvh-5rem)] w-full max-w-xl flex-col overflow-hidden rounded-container border border-outline-variant bg-surface-container-lowest shadow-lg">
        <div className="relative flex min-h-48 shrink-0 flex-col justify-end bg-surface-container md:min-h-56">
          <Image
            src={result.image.src}
            alt={result.image.alt}
            fill
            sizes="(min-width: 640px) 36rem, calc(100vw - 2rem)"
            unoptimized
            className="object-cover object-[center_30%]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-on-surface/85 via-on-surface/35 to-on-surface/10"
          />
          <span className={`absolute left-4 top-4 ${tagClass("solid", onBoard ? "lg" : "sm")}`}>
            {result.copy.badge}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close results"
            className={`absolute right-3 top-3 ${iconButtonClass("onPhoto", size)}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <header className="relative space-y-1 px-4 pb-4 pt-20 sm:px-5 sm:pb-5">
            <h2 id="award-dialog-title" className={HERO_TITLE}>
              {result.copy.headline}
            </h2>
            <p id="award-dialog-subtitle" className="text-sm text-surface/85 sm:text-base">
              {result.copy.sub}
            </p>
          </header>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {viewerRow && (
            <ViewerLine
              row={viewerRow}
              hasWinner={result.winner !== null}
              size={onBoard ? "lg" : "sm"}
            />
          )}

          {!isEmpty && <AwardResultsTable result={result} />}

          {history?.nextRoundCursor && (
            <p className={`${alertClass()} text-sm`}>
              Showing the first 50 rounds.{" "}
              {!onBoard && (
                <button
                  type="button"
                  onClick={goToBoard}
                  className="font-semibold underline underline-offset-4"
                >
                  View the full board
                </button>
              )}
            </p>
          )}

          {isEmpty && (
            <p className={`${EMPTY_STATE} py-6 text-sm text-on-surface-variant`}>
              No standings to show for this game.
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-3 border-t border-outline-variant p-4 sm:justify-end sm:p-5">
          <button
            type="button"
            onClick={onClose}
            data-autofocus={canShare ? undefined : true}
            className={`${controlClass(canShare ? "outline" : "primary", size)} grow sm:grow-0`}
          >
            Done
          </button>
          {!onBoard && (
            <button
              type="button"
              onClick={goToBoard}
              className={`${controlClass("outline", size)} grow sm:grow-0`}
            >
              View board
            </button>
          )}
          {canShare && (
            <button
              type="button"
              onClick={() => void handleShare()}
              data-autofocus
              className={`${controlClass("primary", size)} grow sm:grow-0`}
            >
              Share
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}
