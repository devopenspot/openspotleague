"use client";

import { X } from "lucide-react";

import { Overlay } from "@/components/feedback/Overlay";
import { Countdown } from "@/components/ui/Countdown";
import { ShareActions } from "@/components/ui/ShareActions";
import { GameWeatherBanner } from "@/components/games/layout/GameWeatherBanner";
import type { GameState } from "@/lib/schemas/game";
import { lobbyReadiness } from "@/components/games/board/sheet-state";
import { GuestJoinForm } from "@/components/games/shared/GuestJoinForm";
import { GAME_MODE_LABEL } from "@/lib/games/labels";
import { controlClass } from "@/components/ui/recipes";

const DIALOG_ID = "challenge-start-countdown-dialog";
const TITLE_ID = "challenge-start-countdown-title";
const DESCRIPTION_ID = "challenge-start-countdown-description";
const SHARE_TITLE_ID = "challenge-start-countdown-share-title";

export function ChallengeStartCountdownDialog({
  game,
  isOpen,
  canStartNow,
  busy,
  authenticated,
  canJoin,
  guestName,
  guestJoinError,
  onGuestNameChange,
  onGuestJoin,
  onJoin,
  checkIn,
  onClose,
  onStartNow,
}: {
  game: GameState;
  isOpen: boolean;
  canStartNow: boolean;
  busy: boolean;
  authenticated: boolean;
  canJoin: boolean;
  guestName: string;
  guestJoinError: string | null;
  onGuestNameChange: (name: string) => void;
  onGuestJoin: () => void;
  /** Signed-in riders who can still join. */
  onJoin?: () => void;
  /** Set while the viewer still has to check in at the spot. */
  checkIn?: { label: string; pending: boolean; onCheckIn: () => void } | null;
  onClose: () => void;
  onStartNow: () => void;
}) {
  if (!game.scheduledStartAt) return null;

  const readinessMessage = lobbyReadiness(game);
  const showGuestJoinForm = !authenticated && canJoin;

  return (
    <Overlay
      isOpen={isOpen}
      onClose={() => {
        if (!busy) onClose();
      }}
      labelledBy={TITLE_ID}
      describedBy={`${DESCRIPTION_ID} ${DIALOG_ID}-readiness`}
      contentId={DIALOG_ID}
      panelClassName="mx-5 w-[min(30rem,calc(100vw-2.5rem))] overflow-hidden rounded-container border border-outline-variant bg-surface-bright p-0 shadow-[0_16px_48px_rgba(18,18,18,0.16)]"
    >
      <div className="border-b border-outline-variant bg-on-surface px-5 py-5 text-surface sm:px-6 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-primary">
              Lobby — Get Ready
            </p>
            <h2
              id={TITLE_ID}
              className="mt-2 font-display text-2xl font-bold uppercase leading-[1.05] tracking-[-0.02em] sm:text-3xl"
            >
              {game.gameName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close countdown"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-container border border-surface/25 text-surface transition-colors hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p
          id={DESCRIPTION_ID}
          className="mt-3 max-w-md text-sm leading-5 text-surface-dim"
        >
          Everyone sees the same countdown. The host can drop in early once
          every rider has checked in.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-container border border-outline-variant bg-surface-container-lowest p-4 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-secondary">
            Starts in
          </p>
          <Countdown
            target={game.scheduledStartAt}
            label="Starts in"
            className="mt-2 block text-3xl tracking-tight text-on-surface sm:text-4xl"
          />
        </div>

        <div
          id={`${DIALOG_ID}-readiness`}
          role="status"
          className="border-l-2 border-primary pl-3 text-sm leading-6 text-on-surface-variant"
        >
          {readinessMessage}
        </div>

        {checkIn ? (
          <button
            type="button"
            onClick={checkIn.onCheckIn}
            disabled={busy || checkIn.pending}
            className={`w-full ${controlClass("primary", "lg")}`}
          >
            <span aria-live="polite">{checkIn.label}</span>
          </button>
        ) : null}

        {authenticated && canJoin && onJoin ? (
          <button
            type="button"
            onClick={onJoin}
            disabled={busy}
            className={`w-full ${controlClass("primary", "lg")}`}
          >
            Join This Lobby
          </button>
        ) : null}

        <GameWeatherBanner game={game} />

        {showGuestJoinForm ? (
          <section
            aria-labelledby={`${DIALOG_ID}-join-title`}
            className="rounded-container border border-primary/30 bg-primary-container p-4 text-on-primary-container"
          >
            <h3
              id={`${DIALOG_ID}-join-title`}
              className="font-display text-xs font-bold uppercase tracking-[0.06em]"
            >
              Join This Lobby
            </h3>
            <p className="mt-1 text-sm leading-5">
              Pick a rider name to join before the host drops in.
            </p>
            <GuestJoinForm
              inputId={`${DIALOG_ID}-guest-name`}
              guestName={guestName}
              guestJoinError={guestJoinError}
              busy={busy}
              onGuestNameChange={onGuestNameChange}
              onGuestJoin={onGuestJoin}
              className="mt-3 flex w-full flex-wrap gap-2"
            />
          </section>
        ) : null}

        <section
          aria-labelledby={SHARE_TITLE_ID}
          className="border-t border-outline-variant pt-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3
                id={SHARE_TITLE_ID}
                className="font-display text-xs font-bold uppercase tracking-[0.06em] text-secondary"
              >
                Invite A Rider
              </h3>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Share the code, link or QR.
              </p>
            </div>
            <code className="shrink-0 font-display text-xs font-bold tracking-[0.12em] text-on-surface">
              {game.shareCode}
            </code>
          </div>
          <ShareActions
            url={`/games/join/${encodeURIComponent(game.shareCode)}`}
            code={game.shareCode}
            title={`${game.gameName} ${GAME_MODE_LABEL[game.mode].toLowerCase()}`}
            showShare={false}
            compact
            className="mt-3"
          />
        </section>

        {game.viewerIsHost ? (
          <button
            type="button"
            onClick={onStartNow}
            disabled={busy || !canStartNow}
            className={`w-full ${controlClass("primary", "lg")}`}
          >
            {busy ? "Dropping In…" : "Drop In Now"}
          </button>
        ) : (
          <p className="rounded-container bg-surface-container px-4 py-3 text-center font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant">
            Waiting for the host to drop in
          </p>
        )}

      </div>
    </Overlay>
  );
}
