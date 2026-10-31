"use client";

import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { useState } from "react";

import {
  BottomSheet,
  type SheetDetent,
} from "@/components/feedback/BottomSheet";
import { ChallengeRiderTracksContent } from "@/components/games/board/ChallengeRiderTracks";
import { LobbyInvite } from "@/components/games/board/LobbyInvite";
import {
  PendingResultBar,
  pendingResultStatus,
} from "@/components/games/board/PendingResultBar";
import {
  GAME_SHEET_PEEK_PX,
  initialDetentState,
  nextDetentState,
  type GameSheetActionId,
  type GameSheetSessionActionId,
  type GameSheetView,
} from "@/components/games/board/sheet-state";
import type { PendingResult } from "@/components/games/hooks/usePendingResult";
import type { Result } from "@/components/games/layout/header-state";
import { GuestJoinForm } from "@/components/games/shared/GuestJoinForm";
import { Countdown } from "@/components/ui/Countdown";
import { LocationBlockedCallout } from "@/components/ui/LocationBlockedCallout";
import type { GameState } from "@/lib/schemas/game";

export const GAME_SHEET_ID = "game-sheet";

const ACTION_BASE =
  "inline-flex min-h-[72px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 font-display text-lg font-bold uppercase leading-tight tracking-[0.04em] transition-transform focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed";
const ACTION_PRIMARY =
  "border-2 border-primary bg-primary text-on-primary disabled:border-outline disabled:bg-surface-container-high disabled:text-on-surface";
const ACTION_SECONDARY =
  "border-[3px] border-on-surface bg-surface-container-lowest text-on-surface disabled:border-outline";

type Props = {
  game: GameState;
  view: GameSheetView;
  busy: boolean;
  error: string | null;
  effectiveLevel: number | null;
  levelLabel: string | null;
  resultAction: { onSelect: (result: Result) => void } | null;
  pendingResult: PendingResult | null;
  shareUrl: string;
  canAdvanceToNextTrick: boolean;
  alternativeTricksRemaining: number;
  showGuestForm: boolean;
  guestName: string;
  guestJoinError: string | null;
  showLocationBanner: boolean;
  onGuestNameChange: (name: string) => void;
  onGuestJoin: () => void;
  onRetryLocation: () => void;
  onNextTrick: () => void;
  onUndoResult: () => void;
  onResendResult: () => void;
  onAction: (id: GameSheetActionId) => void;
  onSessionAction: (id: GameSheetSessionActionId) => void;
};

export function GameSheet({
  game,
  view,
  busy,
  error,
  effectiveLevel,
  levelLabel,
  resultAction,
  pendingResult,
  shareUrl,
  canAdvanceToNextTrick,
  alternativeTricksRemaining,
  showGuestForm,
  guestName,
  guestJoinError,
  showLocationBanner,
  onGuestNameChange,
  onGuestJoin,
  onRetryLocation,
  onNextTrick,
  onUndoResult,
  onResendResult,
  onAction,
  onSessionAction,
}: Props) {
  const [detentState, setDetentState] = useState(() => initialDetentState(view));
  const resolvedDetent = nextDetentState(detentState, view);
  if (resolvedDetent !== detentState) setDetentState(resolvedDetent);

  const current = game.currentRound;
  const showTrick =
    game.status === "active" && Boolean(current?.trickName) && view.phase !== "terminal";

  const status = pendingResult ? pendingResultStatus(pendingResult) : view.status;
  const visibleError = pendingResult ? null : error;

  function moveSheet(detent: SheetDetent) {
    setDetentState((state) => ({ ...state, detent, userChose: true }));
  }

  return (
    <>
      <p role="status" className="sr-only">
        {status}
      </p>
      {visibleError ? (
        <p role="alert" className="sr-only">
          {visibleError}
        </p>
      ) : null}
      <BottomSheet
        label="Game controls"
        testId={GAME_SHEET_ID}
        detent={resolvedDetent.detent}
        onDetentChange={moveSheet}
        peekHeight={GAME_SHEET_PEEK_PX}
        handle={
          visibleError ? (
            <span className="flex min-w-0 items-center gap-2 text-error">
              <AlertTriangle size={20} aria-hidden="true" className="shrink-0" />
              <span className="line-clamp-2 font-display text-sm font-bold leading-tight">
                {visibleError}
              </span>
            </span>
          ) : (
            <span className="block truncate font-display text-base font-bold">
              {status}
            </span>
          )
        }
        footer={
          pendingResult ? (
            <PendingResultBar
              pending={pendingResult}
              size="sheet"
              onUndo={onUndoResult}
              onResend={onResendResult}
            />
          ) : view.showResults && resultAction ? (
            <ResultButtons busy={busy} onSelect={resultAction.onSelect} />
          ) : view.actions.length > 0 ? (
            <div className="flex gap-3">
              {view.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={busy || action.disabled}
                  onClick={() => onAction(action.id)}
                  className={`${ACTION_BASE} ${action.tone === "primary" ? ACTION_PRIMARY : ACTION_SECONDARY}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null
        }
      >
        <div className="space-y-5 px-4 pb-5 pt-1">
          {game.status === "lobby" && game.scheduledStartAt ? (
            <div className="text-center">
              <Countdown
                target={game.scheduledStartAt}
                label="Session Starts In"
                className="block text-[40px] leading-none tracking-tight text-on-surface"
              />
              <p className="mt-1 font-display text-sm font-semibold text-on-surface-variant">
                Until drop in
              </p>
            </div>
          ) : null}

          {view.detail ? (
            <p className="text-base leading-6 text-on-surface">{view.detail}</p>
          ) : null}

          {showLocationBanner ? (
            <LocationBlockedCallout
              variant="banner"
              onRetry={onRetryLocation}
              className="w-full"
            />
          ) : null}

          {view.showInvite ? <LobbyInvite url={shareUrl} /> : null}

          {showGuestForm ? (
            <GuestJoinForm
              inputId="guest-name-sheet"
              guestName={guestName}
              guestJoinError={guestJoinError}
              busy={busy}
              size="large"
              showSubmit={false}
              onGuestNameChange={onGuestNameChange}
              onGuestJoin={onGuestJoin}
              className="flex w-full flex-col gap-2"
            />
          ) : null}

          {showTrick && current ? (
            <section aria-labelledby="game-sheet-trick-title">
              <h2
                id="game-sheet-trick-title"
                className="font-display text-[28px] font-bold leading-[1.15] tracking-[-0.02em]"
              >
                {current.trickName}
              </h2>
              <p className="mt-1.5 font-display text-sm font-semibold text-on-surface-variant">
                {[
                  `Round ${current.sequence}`,
                  current.spotType,
                  effectiveLevel ? `Level ${effectiveLevel}` : null,
                  levelLabel,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {current.trickDescription ? (
                <p className="mt-3 text-base leading-6 text-on-surface">
                  {current.trickDescription}
                </p>
              ) : null}
              {canAdvanceToNextTrick ? (
                <button
                  type="button"
                  onClick={onNextTrick}
                  disabled={
                    busy ||
                    Boolean(pendingResult) ||
                    alternativeTricksRemaining === 0
                  }
                  className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:border-outline"
                >
                  <RotateCcw size={18} aria-hidden="true" />
                  {alternativeTricksRemaining > 0
                    ? `Skip Trick (${alternativeTricksRemaining} Left)`
                    : "No Skips Left"}
                </button>
              ) : null}
            </section>
          ) : null}

          {showTrick && current && current.attempts.length > 0 ? (
            <ul aria-label="Results this round" className="flex flex-wrap gap-2">
              {current.attempts.map((attempt) => (
                <li
                  key={attempt.playerId}
                  className="rounded-md border-2 border-on-surface px-2.5 py-1 font-display text-sm font-bold"
                >
                  {game.players.find((player) => player.id === attempt.playerId)
                    ?.displayName ?? "Rider"}{" "}
                  · {attempt.result}
                </li>
              ))}
            </ul>
          ) : null}

          {game.trainingVariant !== "solo" ? (
            <section>
              <ChallengeRiderTracksContent
                game={game}
                headingId="game-sheet-crew-title"
              />
            </section>
          ) : null}

          <nav aria-label="Session" className="grid gap-3">
            {view.sessionActions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={busy && action.id !== "back"}
                aria-haspopup={
                  action.id === "cancel" || action.id === "invite"
                    ? "dialog"
                    : undefined
                }
                onClick={() => onSessionAction(action.id)}
                className="min-h-12 w-full rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:border-outline"
              >
                {action.label}
              </button>
            ))}
          </nav>
        </div>
      </BottomSheet>
    </>
  );
}

function ResultButtons({
  busy,
  onSelect,
}: {
  busy: boolean;
  onSelect: (result: Result) => void;
}) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => onSelect("failed")}
        aria-label="Mark as failed"
        className={`${ACTION_BASE} ${ACTION_SECONDARY}`}
      >
        <X size={24} strokeWidth={2.75} aria-hidden="true" />
        Failed
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onSelect("landed")}
        aria-label="Mark as landed"
        className={`${ACTION_BASE} ${ACTION_PRIMARY}`}
      >
        <Check size={24} strokeWidth={2.75} aria-hidden="true" />
        Landed
      </button>
    </div>
  );
}
