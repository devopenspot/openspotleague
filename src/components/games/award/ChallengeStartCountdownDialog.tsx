"use client";

import { X } from "lucide-react";

import { Overlay } from "@/components/feedback/Overlay";
import { Countdown } from "@/components/ui/Countdown";
import { ShareActions } from "@/components/ui/ShareActions";
import { GameWeatherBanner } from "@/components/games/layout/GameWeatherBanner";
import type { GameState } from "@/lib/schemas/game";
import { GuestJoinForm } from "@/components/games/shared/GuestJoinForm";

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
  onClose: () => void;
  onStartNow: () => void;
}) {
  if (!game.scheduledStartAt) return null;

  const activeRiderCount = game.players.filter(
    (player) => player.status === "active",
  ).length;
  const verifiedRiderCount =
    game.currentRound?.verifications.filter(
      (verification) =>
        verification.status === "verified" &&
        game.players.some(
          (player) =>
            player.id === verification.playerId && player.status === "active",
        ),
    ).length ?? 0;
  const readinessMessage =
    activeRiderCount < 2
      ? "Need One More Rider To Drop In!"
      : verifiedRiderCount < activeRiderCount
        ? "Everyone Needs To Check In At The Spot Before The Host Can Drop In."
        : "Crew Is Ready — Host Can Drop In Anytime!";
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
      panelClassName="mx-5 w-[min(30rem,calc(100vw-2.5rem))] overflow-hidden rounded-[16px] border border-outline-variant bg-surface-bright p-0 shadow-[0_16px_48px_rgba(18,18,18,0.16)]"
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
            aria-label="Close challenge countdown"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-surface/25 text-surface transition-colors hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p
          id={DESCRIPTION_ID}
          className="mt-3 max-w-md text-sm leading-5 text-surface-dim"
        >
          Everyone Sees The Same Countdown. Host Can Drop In Early Once The
          Crew Is Checked In.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.08em] text-secondary">
            Dropping In
          </p>
          <Countdown
            target={game.scheduledStartAt}
            label="Session Starts In"
            className="mt-2 block text-3xl tracking-tight text-on-surface sm:text-4xl"
          />
          {isOpen ? (
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">
              Scheduled: {new Date(game.scheduledStartAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <div
          id={`${DIALOG_ID}-readiness`}
          role="status"
          className="border-l-2 border-primary pl-3 text-sm leading-6 text-on-surface-variant"
        >
          {readinessMessage}
        </div>

        <GameWeatherBanner game={game} />

        {showGuestJoinForm ? (
          <section
            aria-labelledby={`${DIALOG_ID}-join-title`}
            className="rounded-[16px] border border-primary/30 bg-primary-container p-4 text-on-primary-container"
          >
            <h3
              id={`${DIALOG_ID}-join-title`}
              className="font-display text-xs font-bold uppercase tracking-[0.06em]"
            >
              Join This Lobby
            </h3>
            <p className="mt-1 text-sm leading-5">
              Pick A Rider Name To Join Before The Host Drops In.
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
                Invite Your Crew
              </h3>
              <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                Share The Crew Code, Link, Or QR.
              </p>
            </div>
            <code className="shrink-0 font-display text-xs font-bold tracking-[0.12em] text-on-surface">
              {game.shareCode}
            </code>
          </div>
          <ShareActions
            url={`/games/join/${encodeURIComponent(game.shareCode)}`}
            code={game.shareCode}
            title={`${game.gameName} challenge`}
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
            className="min-h-11 w-full rounded-full bg-primary px-5 font-display text-xs font-bold uppercase tracking-[0.06em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
          >
            {busy ? "Dropping In…" : "Drop In Now"}
          </button>
        ) : (
          <p className="rounded-[16px] bg-surface-container px-4 py-3 text-center font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface-variant">
            Waiting For Host To Drop In
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="min-h-11 w-full rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue To Lobby
        </button>
      </div>
    </Overlay>
  );
}
