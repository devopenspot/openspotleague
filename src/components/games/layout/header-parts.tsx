"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import {
  DrawerHeader,
  SIDE_DRAWER_PANEL,
} from "@/components/feedback/DrawerParts";
import { Overlay } from "@/components/feedback/Overlay";
import { SideDrawer } from "@/components/feedback/SideDrawer";
import { type BadgeTone } from "@/components/ui/Badge";
import { ShareActions } from "@/components/ui/ShareActions";
import { GameWeatherBanner } from "@/components/games/layout/GameWeatherBanner";
import type { GameState } from "@/lib/schemas/game";

export const DRAWER_ID = "game-header-drawer";
export const DRAWER_TITLE_ID = "game-header-share-title";

const CANCEL_DIALOG_TITLE_ID = "game-cancel-dialog-title";
const CANCEL_DIALOG_DESCRIPTION_ID = "game-cancel-dialog-description";

type Player = GameState["players"][number];
type Round = NonNullable<GameState["currentRound"]>;
type PendingProposal = NonNullable<GameState["pendingCategoryProposal"]>;

/** Chips strip in the sticky bar: riders, mode, level, categories, leader. */
export function GameStatusStrip({
  game,
  current,
  leader,
  effectiveLevel,
  levelLabel,
  isCategoriesAll,
  categoriesDisplay,
  hasPendingCategories,
  pendingProposal,
}: {
  game: GameState;
  current: Round | null | undefined;
  leader: Player | undefined;
  effectiveLevel: number | null;
  levelLabel: string | null;
  isCategoriesAll: boolean;
  categoriesDisplay: string;
  hasPendingCategories: boolean;
  pendingProposal: PendingProposal | null;
}) {
  return (
    <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-2 overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-low px-2.5 py-1.5 font-display text-xs font-semibold tracking-[0.03em] text-on-surface-variant lg:order-none lg:flex-1 lg:flex-nowrap lg:overflow-x-auto">
      <span className="inline-flex shrink-0 items-center rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold">
        {game.players.length} {game.players.length === 1 ? "Rider" : "Riders"}
      </span>
      <span className="inline-flex shrink-0 items-center rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold capitalize">
        {game.mode === "training" ? "Training" : "Challenge"}
      </span>
      <span className="inline-flex shrink-0 items-center rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold">
        {game.trainingVariant === "solo"
          ? "Solo Session"
          : game.ruleMode === "flexible"
            ? "Flexible Rules"
            : "Strict Rules"}
      </span>
      {effectiveLevel && levelLabel ? (
        <span
          className="inline-flex shrink-0 items-center rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold"
          aria-label={`Level ${effectiveLevel} ${levelLabel}`}
          title={`Level ${effectiveLevel} · ${levelLabel}`}
        >
          Level {effectiveLevel} · {levelLabel}
        </span>
      ) : null}
      <span
        className={`inline-flex min-w-0 max-w-[12rem] items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-bold ${hasPendingCategories ? "border border-primary/40 bg-primary-container text-on-primary-container" : "bg-surface-container-high"}`}
        aria-label={
          isCategoriesAll
            ? "Categories: All"
            : `Categories: ${categoriesDisplay}`
        }
        title={
          hasPendingCategories
            ? `Current: ${categoriesDisplay} · Pending: ${pendingProposal?.categories.length === 0 ? "All" : (pendingProposal?.categories.join(", ") ?? "")}`
            : isCategoriesAll
              ? "All categories"
              : categoriesDisplay
        }
      >
        {hasPendingCategories ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
            aria-hidden="true"
          />
        ) : null}
        <span className="min-w-0 truncate">
          {isCategoriesAll ? "All Categories" : categoriesDisplay}
        </span>
      </span>

      {leader && current ? (
        <span className="inline-flex min-w-0 max-w-[10rem] items-center gap-1.5 truncate rounded-full bg-primary-container px-2.5 py-1 text-xs font-bold text-on-primary-container">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
            aria-hidden="true"
          />
          <span className="min-w-0">{leader.displayName} Leads</span>
        </span>
      ) : null}
      {game.spotId && game.weatherForecastIcon ? (
        <GameWeatherBanner game={game} variant="compact" />
      ) : null}
    </div>
  );
}

/** Session-complete / cancelled banner rendered under the sticky bar. */
export function TerminalResultBar({
  tone,
  title,
  description,
  showResultsLink,
  onViewResults,
  onBackToChallenges,
  showRunAgain,
}: {
  tone: Extract<BadgeTone, "success" | "info" | "danger">;
  label: string;
  title: string;
  description: string;
  showResultsLink: boolean;
  onViewResults?: () => void;
  onBackToChallenges: () => void;
  showRunAgain: boolean;
}) {
  const barClasses =
    tone === "success"
      ? "border-secondary/30 bg-secondary-container text-on-secondary-container"
      : tone === "danger"
        ? "border-error/35 bg-error-container text-on-error-container"
        : "border-secondary/30 bg-secondary-container text-on-secondary-container";
  return (
    <div className="border-t border-outline-variant py-3 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div
          role="status"
          aria-labelledby="terminal-result-title"
          className={`flex flex-col gap-3 rounded-[16px] border p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4 ${barClasses}`}
        >
          <div className="flex min-w-0 flex-col items-start gap-3 md:flex-row">
            <div className="min-w-0">
              <h2
                id="terminal-result-title"
                className="font-display text-xl font-semibold leading-[1.3]"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm leading-5">{description}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {onViewResults && showResultsLink ? (
              <button
                type="button"
                onClick={onViewResults}
                aria-label="View championship results"
                className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
              >
                results
              </button>
            ) : null}
            <button
              type="button"
              onClick={onBackToChallenges}
              className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
            >
              Back
            </button>
            {showRunAgain ? (
              <Link
                href="/games"
                className="inline-flex min-h-11 items-center rounded-full border border-primary bg-primary px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
              >
                Run It Again
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Invite drawer: share code, link, QR, weather. */
export function GameShareDrawer({
  isOpen,
  onClose,
  game,
  sharePath,
}: {
  isOpen: boolean;
  onClose: () => void;
  game: GameState | null;
  sharePath: string | null;
}) {
  return (
    <SideDrawer
      isOpen={isOpen}
      onClose={onClose}
      labelledBy={DRAWER_TITLE_ID}
      contentId={DRAWER_ID}
      testId={DRAWER_ID}
      panelClassName={`${SIDE_DRAWER_PANEL} bg-surface`}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <DrawerHeader
          eyebrow={game?.gameName ?? "Session Status"}
          title={game ? "Invite A Rider" : "Game Controls"}
          titleId={DRAWER_TITLE_ID}
          closeLabel="Close game controls"
          onClose={onClose}
        />
        {game && sharePath ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-5 px-5 py-5">
              <section aria-labelledby="game-share-code-title">
                <div className="mt-3 flex items-center justify-between gap-4 rounded-[8px] border border-outline-variant bg-surface-container-low px-3 py-2.5">
                  <h3
                    id="game-share-code-title"
                    className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary"
                  >
                    Share Code
                  </h3>
                  <code className="font-display text-sm font-bold tracking-[0.12em] text-on-surface">
                    {game.shareCode}
                  </code>
                </div>
                <ShareActions
                  url={sharePath}
                  code={game.shareCode}
                  title={`${game.gameName} challenge`}
                  compact
                  className="mt-3"
                />
                <GameWeatherBanner game={game} />
              </section>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Game Controls Will Be Available When Your Session Loads.
            </p>
          </div>
        )}
      </div>
    </SideDrawer>
  );
}

/** Confirmation alertdialog before ending a lobby or active session. */
export function CancelSessionDialog({
  isOpen,
  busy,
  isSoloRun,
  canCancelActive,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  busy: boolean;
  isSoloRun: boolean;
  canCancelActive: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      labelledBy={CANCEL_DIALOG_TITLE_ID}
      describedBy={CANCEL_DIALOG_DESCRIPTION_ID}
      contentId="game-cancel-dialog"
      role="alertdialog"
      panelClassName="mx-5 w-[min(32rem,calc(100vw-2.5rem))] rounded-[16px] border border-error bg-surface p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-error-container text-on-error-container">
          <AlertTriangle size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-error">
            Session Control
          </p>
          <h2
            id={CANCEL_DIALOG_TITLE_ID}
            className="mt-2 font-display text-[32px] font-bold leading-[1.3]"
          >
            {isSoloRun
              ? "Finish This Run?"
              : canCancelActive
                ? "Finish This Challenge?"
                : "End This Session?"}
          </h2>
          <p
            id={CANCEL_DIALOG_DESCRIPTION_ID}
            className="mt-3 text-sm leading-6 text-on-surface-variant"
          >
            Everyone Will Head Back To The Lobby And The Session Ends
            Immediately. You Can Start A New Run Right After.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
        >
          Keep Riding
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="min-h-11 rounded-full border border-error bg-error px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-error transition-[background-color,transform] hover:bg-error/90 focus-visible:outline-2 focus-visible:outline-error focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
        >
          {busy
            ? "Finishing…"
            : isSoloRun
              ? "Yes, Finish Run"
              : canCancelActive
                ? "Yes, Finish Challenge"
                : "Yes, End Session"}
        </button>
      </div>
    </Overlay>
  );
}
