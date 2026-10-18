"use client";

import { Settings2, Share } from "lucide-react";
import { startTransition, useEffect, useRef, useState } from "react";

import { LocationBlockedCallout } from "@/components/ui/LocationBlockedCallout";
import { ChallengeStartCountdownDialog } from "@/components/games/award/ChallengeStartCountdownDialog";
import { GuestJoinForm } from "@/components/games/shared/GuestJoinForm";
import type { GameCapabilities } from "@/lib/games/capabilities";
import type { GameState } from "@/lib/schemas/game";
import {
  deriveHeaderState,
  EMPTY_CAPABILITIES,
  type LocationPermission,
  type Result,
} from "@/components/games/layout/header-state";
import {
  CancelSessionDialog,
  DRAWER_ID,
  GameShareDrawer,
  GameStatusStrip,
  TerminalResultBar,
} from "@/components/games/layout/header-parts";
import { TrickActionDrawer } from "@/components/games/layout/TrickActionDrawer";
import {
  hasSeenShareOnboarding,
  markShareOnboardingSeen,
} from "@/components/games/layout/share-onboarding";
import { Led } from "./panel/PanelIndicators";

const noop = () => undefined;

/**
 * Board-owned control deck — migrated from `Header` (see `GameBoard.tsx:393` TODO).
 * Tailored to video-game panel: mono, compact 11px/36px pills, outside `PanelShell` so
 * `PanelShell` only wraps the CRT screen. Keeps every behavior/feature intact.
 *
 * Data order (UX hierarchy, mono + primary discipline per DESIGN.md):
 *  [A] Identity + System — game name, live LED, share/back (always)
 *  [B] Context strip — riders/mode/level/categories/leader/weather (secondary)
 *  [C] Primary action deck — phase-driven single primary CTA (lobby/active/guest)
 *  [D] Notices / terminal — amber round notice, blocked-location banner, results
 */
export function GameBoardControls({
  game,
  connection = "connected",
  authenticated = true,
  busy = false,
  locationPending = false,
  locationPermission = "unknown",
  capabilities = EMPTY_CAPABILITIES,
  canConfigureChallenge = false,
  settingsModalOpen = false,
  guestName = "",
  guestJoinError = null,
  alternativeTricksRemaining = 3,
  onGuestNameChange = noop,
  onGuestJoin = noop,
  onVerifyLocation = noop,
  onChallengeResult = noop,
  onNextTrick = noop,
  onAttemptResult = noop,
  onJoinLobby = noop,
  onStartLobby = noop,
  onStartNow = noop,
  onTrainAlone = noop,
  onCancelLobby = noop,
  onLeaveLobby = noop,
  onCancelActive = noop,
  onOpenSettings = noop,
  onBackToChallenges,
  onViewResults,
}: {
  game: GameState | null;
  connection?: "connected" | "reconnecting";
  authenticated?: boolean;
  busy?: boolean;
  locationPending?: boolean;
  locationPermission?: LocationPermission;
  capabilities?: GameCapabilities;
  canConfigureChallenge?: boolean;
  settingsModalOpen?: boolean;
  guestName?: string;
  guestJoinError?: string | null;
  alternativeTricksRemaining?: number;
  onGuestNameChange?: (name: string) => void;
  onGuestJoin?: () => void;
  onVerifyLocation?: () => void;
  onChallengeResult?: (result: Result) => void;
  onNextTrick?: () => void;
  onAttemptResult?: (result: Result) => void;
  onJoinLobby?: () => void;
  onStartLobby?: () => void;
  onStartNow?: () => void;
  onTrainAlone?: () => void;
  onCancelLobby?: () => void;
  onLeaveLobby?: () => void;
  onCancelActive?: () => void;
  onOpenSettings?: () => void;
  onBackToChallenges: () => void;
  onViewResults?: () => void;
}) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isShareOnboardingOpen, setIsShareOnboardingOpen] = useState(false);
  const [isCountdownOpen, setIsCountdownOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isTrickDrawerOpen, setIsTrickDrawerOpen] = useState(false);
  const shareOnboardingGameRef = useRef<string | null>(null);
  const countdownGameRef = useRef<string | null>(null);
  const lastTrickDrawerRoundRef = useRef<string | null>(null);

  const {
    current,
    leader,
    effectiveLevel,
    levelLabel,
    isCategoriesAll,
    categoriesDisplay,
    pendingProposal,
    hasPendingCategories,
    isComplete,
    isTerminal,
    isLiveChallenge,
    canJoinLobby,
    canStartLobby,
    canTrainAlone,
    canCancelLobby,
    canLeaveLobby,
    canCancelActive,
    canCancel,
    lobbyReady,
    roundNotice,
    terminalTone,
    terminalLabel,
    terminalTitle,
    terminalDescription,
    isWaitingForOthers,
    pendingCount,
    pendingNames,
    shouldPromptTrickDrawer,
  } = deriveHeaderState(game, capabilities);

  const sharePath = game
    ? `/games/join/${encodeURIComponent(game.shareCode)}`
    : null;
  const shareOnboardingGameId = game?.id ?? null;
  const isHostLobby = Boolean(
    game && game.status === "lobby" && game.viewerIsHost,
  );
  const isScheduledChallengeLobby = Boolean(
    game &&
    game.mode === "challenge" &&
    game.status === "lobby" &&
    game.scheduledStartAt,
  );
  const shouldSuggestShareOnboarding =
    game?.mode === "training" || !capabilities.canTrainAlone;

  useEffect(() => {
    if (!game?.id || !isScheduledChallengeLobby) return;
    if (countdownGameRef.current === game.id) return;
    countdownGameRef.current = game.id;
    setIsCountdownOpen(true);
  }, [game?.id, isScheduledChallengeLobby]);

  useEffect(() => {
    if (
      !shareOnboardingGameId ||
      !isHostLobby ||
      !shouldSuggestShareOnboarding ||
      isScheduledChallengeLobby
    )
      return;
    if (shareOnboardingGameRef.current === shareOnboardingGameId) return;
    shareOnboardingGameRef.current = shareOnboardingGameId;
    if (hasSeenShareOnboarding(shareOnboardingGameId)) return;
    markShareOnboardingSeen(shareOnboardingGameId);
    startTransition(() => {
      setIsDrawerOpen(true);
      setIsShareOnboardingOpen(true);
    });
  }, [
    isHostLobby,
    isScheduledChallengeLobby,
    shareOnboardingGameId,
    shouldSuggestShareOnboarding,
  ]);

  const resultAction: {
    label: string;
    onSelect: (result: Result) => void;
  } | null =
    current && capabilities.canSubmitChallenge
      ? { label: "How'd It Go?", onSelect: onChallengeResult }
      : current && capabilities.canSubmitResponse
        ? { label: "Your Call", onSelect: onAttemptResult }
        : null;
  const hasResultAction = Boolean(resultAction);

  useEffect(() => {
    if (!shouldPromptTrickDrawer || !current) return;
    const promptKey = `${current.id}:${current.status}:${hasResultAction ? "turn" : "wait"}`;
    if (lastTrickDrawerRoundRef.current === promptKey) return;
    lastTrickDrawerRoundRef.current = promptKey;
    startTransition(() => setIsTrickDrawerOpen(true));
  }, [shouldPromptTrickDrawer, current, hasResultAction]);

  function openGameControls() {
    setIsShareOnboardingOpen(false);
    setIsDrawerOpen(true);
  }

  function closeGameControls() {
    setIsShareOnboardingOpen(false);
    setIsDrawerOpen(false);
  }

  const showGuestJoinForm = !authenticated && canJoinLobby;

  function requestCancel() {
    if (!busy) setIsCancelDialogOpen(true);
  }

  function confirmCancel() {
    if (busy) return;
    setIsCancelDialogOpen(false);
    if (canCancelLobby) onCancelLobby();
    else if (canCancelActive) onCancelActive();
  }

  const connectionLed = connection === "connected" ? "live" : "pending";
  const statusLabel = !game
    ? ""
    : game.status === "lobby"
      ? "Lobby — Waiting to drop"
      : game.status === "active"
        ? "Live — Session running"
        : game.status === "complete"
          ? "Complete — Results in"
          : "Closed";
  const showLocationBanner =
    capabilities.canVerifyLocation && locationPermission === "denied";
  const needsVerification =
    capabilities.canVerifyLocation && locationPermission !== "granted";
  const canShowCheckInAgain =
    capabilities.canVerifyLocation &&
    locationPermission === "granted" &&
    !locationPending;
  const hasPrimaryAction =
    showGuestJoinForm ||
    (canJoinLobby && authenticated) ||
    canStartLobby ||
    canTrainAlone ||
    needsVerification ||
    shouldPromptTrickDrawer ||
    isScheduledChallengeLobby;
  const hasSecondaryAction =
    canConfigureChallenge || canCancelActive || canCancelLobby || canLeaveLobby;

  return (
    <>
      {/* deck control — outside chassis, mono, compact 11px/36px pills */}
      <div className="mx-auto flex w-full max-w-7xl shrink-0 flex-col gap-2 px-1 py-2 sm:py-2.5">
        {/* [A] Identity + system — always visible, mono hierarchy per DESIGN.md */}
        {game ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-outline-variant bg-surface-container-low px-2.5 py-2 sm:px-3 sm:py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Led tone={connectionLed} pulse={connection === "reconnecting"} />
              <h2 className="min-w-0 truncate font-display text-[15px] font-bold leading-tight tracking-tight text-on-surface sm:text-[18px]">
                {game.gameName}
              </h2>
              <span className="hidden shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary sm:inline-flex">
                {statusLabel}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* compact status on mobile to preserve scan */}
              <span className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary sm:hidden">
                {game.status === "lobby"
                  ? "Lobby"
                  : game.status === "active"
                    ? "Live"
                    : game.status === "complete"
                      ? "Complete"
                      : "Closed"}
              </span>
              <button
                type="button"
                aria-label="Open game controls"
                aria-controls={DRAWER_ID}
                aria-expanded={isDrawerOpen}
                onClick={openGameControls}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
              >
                <Share size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                type="button"
                onClick={onBackToChallenges}
                className="inline-flex min-h-9 items-center rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-outline-variant bg-surface-container-low px-2.5 py-2 sm:px-3">
            <div className="flex items-center gap-2">
              <Led tone="pending" pulse />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
                Control — Syncing
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                aria-label="Open game controls"
                aria-controls={DRAWER_ID}
                aria-expanded={isDrawerOpen}
                onClick={openGameControls}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
              >
                <Share size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onBackToChallenges}
                className="inline-flex min-h-9 items-center rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* [B] Context strip — secondary, wraps monochrome chips per DESIGN.md */}
        {game ? (
          <GameStatusStrip
            game={game}
            current={current}
            leader={leader}
            effectiveLevel={effectiveLevel}
            levelLabel={levelLabel}
            isCategoriesAll={isCategoriesAll}
            categoriesDisplay={categoriesDisplay}
            hasPendingCategories={hasPendingCategories}
            pendingProposal={pendingProposal}
          />
        ) : null}

        {/* [C] Primary action deck — phase-driven, single primary CTA per row */}
        {game && isTerminal ? (
          <TerminalResultBar
            tone={terminalTone}
            label={terminalLabel}
            title={terminalTitle}
            description={terminalDescription}
            showResultsLink={(game.stageLedger?.length ?? 0) > 0}
            onViewResults={onViewResults}
            onBackToChallenges={onBackToChallenges}
            showRunAgain={isComplete}
          />
        ) : !isTerminal ? (
          hasPrimaryAction || hasSecondaryAction ? (
            <div className="flex flex-col gap-2 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-2 sm:p-2.5">
              {/* tier 1: primary CTA — only one primary visually; others secondary */}
              <div className="flex flex-wrap items-center gap-1.5">
                {showGuestJoinForm ? (
                  <GuestJoinForm
                    inputId="guest-name"
                    guestName={guestName}
                    guestJoinError={guestJoinError}
                    busy={busy}
                    showError={!isCountdownOpen}
                    onGuestNameChange={onGuestNameChange}
                    onGuestJoin={onGuestJoin}
                    className="flex w-full flex-wrap gap-1.5"
                  />
                ) : null}

                {!showGuestJoinForm && canJoinLobby && authenticated ? (
                  <button
                    type="button"
                    onClick={onJoinLobby}
                    disabled={busy}
                    className="min-h-9 rounded-full border border-primary bg-primary px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                  >
                    {busy ? "Joining Crew…" : "Join Crew"}
                  </button>
                ) : null}

                {!showGuestJoinForm && canStartLobby ? (
                  <button
                    type="button"
                    onClick={onStartLobby}
                    disabled={busy || !lobbyReady}
                    aria-label={
                      lobbyReady
                        ? "Drop in and start the session"
                        : "Waiting for riders to be ready"
                    }
                    title={
                      lobbyReady
                        ? undefined
                        : "Need at least 2 checked-in riders"
                    }
                    className="min-h-10 rounded-full border border-primary bg-primary px-5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary shadow-sm transition-[background-color,transform,box-shadow] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Dropping In…" : "Drop In"}
                  </button>
                ) : null}

                {!showGuestJoinForm && canTrainAlone ? (
                  <button
                    type="button"
                    onClick={onTrainAlone}
                    disabled={busy}
                    className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                  >
                    {busy ? "Starting Solo…" : "Ride Solo"}
                  </button>
                ) : null}

                {isScheduledChallengeLobby && !isCountdownOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsCountdownOpen(true)}
                    className="inline-flex min-h-9 items-center rounded-full border border-primary/40 bg-primary-container px-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary-container transition-[background-color,transform] hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
                  >
                    Countdown
                  </button>
                ) : null}

                {needsVerification ? (
                  <button
                    type="button"
                    disabled={busy || locationPending}
                    aria-label={
                      locationPermission === "denied"
                        ? "Fix Location To Ride"
                        : locationPermission === "unavailable"
                          ? "Try Again"
                          : "Check In At Spot"
                    }
                    onClick={onVerifyLocation}
                    className="min-h-9 rounded-full border border-primary bg-primary px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                  >
                    {locationPending
                      ? "Checking You In…"
                      : locationPermission === "denied"
                        ? "Fix Location To Ride"
                        : locationPermission === "unavailable"
                          ? "Try Again"
                          : "Check In At Spot"}
                  </button>
                ) : null}

                {canShowCheckInAgain ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onVerifyLocation}
                    className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                  >
                    Check In Again
                  </button>
                ) : null}

                {shouldPromptTrickDrawer ? (
                  <button
                    type="button"
                    onClick={() => setIsTrickDrawerOpen(true)}
                    aria-label={
                      resultAction
                        ? "Open your turn panel"
                        : "Open waiting for riders panel"
                    }
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] transition-[background-color,transform,border-color] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px ${resultAction ? "border-primary bg-primary text-on-primary shadow-[0_2px_0_rgba(0,0,0,0.12)]" : "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${resultAction ? "bg-on-primary" : "bg-permission-pending animate-pulse-dot"}`}
                      aria-hidden
                    />
                    {resultAction
                      ? "Your Turn — Open Panel"
                      : `Waiting · ${pendingCount} rider${pendingCount === 1 ? "" : "s"}`}
                  </button>
                ) : null}

                {/* tier 2: management — outline, separated; still compact 11px/36px */}
                {hasSecondaryAction ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {canConfigureChallenge && !isTerminal ? (
                      <button
                        type="button"
                        aria-label={
                          isLiveChallenge ? "Switch It Up" : "Set The Line"
                        }
                        aria-controls="challenge-settings-drawer"
                        aria-expanded={settingsModalOpen}
                        onClick={onOpenSettings}
                        disabled={busy}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-container px-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary-container transition-[background-color,transform] hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                      >
                        <Settings2 size={15} aria-hidden="true" />
                        <span className="hidden sm:inline">
                          {isLiveChallenge ? "Switch It Up" : "Set The Line"}
                        </span>
                        <span className="sm:hidden">Line</span>
                      </button>
                    ) : null}

                    {canCancelActive ? (
                      <button
                        type="button"
                        onClick={requestCancel}
                        disabled={busy}
                        aria-haspopup="dialog"
                        title={
                          game?.trainingVariant === "solo"
                            ? "Wrap up your solo run"
                            : "End the challenge for everyone"
                        }
                        className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                      >
                        {game?.trainingVariant === "solo"
                          ? "Finish Run"
                          : "Finish Challenge"}
                      </button>
                    ) : null}

                    {canCancelLobby ? (
                      <button
                        type="button"
                        onClick={requestCancel}
                        disabled={busy}
                        aria-haspopup="dialog"
                        title="Ends this session for all riders"
                        className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                      >
                        End Session
                      </button>
                    ) : null}

                    {canLeaveLobby ? (
                      <button
                        type="button"
                        onClick={onLeaveLobby}
                        disabled={busy}
                        className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                      >
                        Step Out
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null
        ) : null}

        {/* [D] Notices — tonal, role=status, monochrome per DESIGN.md */}
        {roundNotice ? (
          <p
            role="status"
            className="rounded-[12px] border border-primary/25 bg-primary-container/60 px-3 py-2.5 text-sm leading-5 text-on-primary-container"
          >
            {roundNotice}
          </p>
        ) : null}

        {showLocationBanner ? (
          <LocationBlockedCallout
            variant="banner"
            onRetry={onVerifyLocation}
            className="w-full"
          />
        ) : null}
      </div>

      <GameShareDrawer
        isOpen={isDrawerOpen}
        onClose={closeGameControls}
        game={game}
        sharePath={sharePath}
        isShareOnboardingOpen={isShareOnboardingOpen}
        canTrainAlone={canTrainAlone}
      />
      <TrickActionDrawer
        isOpen={isTrickDrawerOpen}
        onClose={() => setIsTrickDrawerOpen(false)}
        game={game}
        current={current}
        disciplineSlug={game?.disciplineSlug ?? null}
        effectiveLevel={effectiveLevel}
        levelLabel={levelLabel}
        isWaitingForOthers={isWaitingForOthers}
        pendingCount={pendingCount}
        pendingNames={pendingNames}
        canAdvanceToNextTrick={capabilities.canAdvanceToNextTrick}
        alternativeTricksRemaining={alternativeTricksRemaining}
        busy={busy}
        resultAction={resultAction}
        onNextTrick={onNextTrick}
      />
      <CancelSessionDialog
        isOpen={isCancelDialogOpen && canCancel}
        busy={busy}
        isSoloRun={game?.trainingVariant === "solo"}
        canCancelActive={canCancelActive}
        onClose={() => setIsCancelDialogOpen(false)}
        onConfirm={confirmCancel}
      />
      {game && isScheduledChallengeLobby ? (
        <ChallengeStartCountdownDialog
          game={game}
          isOpen={isCountdownOpen}
          canStartNow={capabilities.canStartNow}
          busy={busy}
          authenticated={authenticated}
          canJoin={canJoinLobby}
          guestName={guestName}
          guestJoinError={guestJoinError}
          onGuestNameChange={onGuestNameChange}
          onGuestJoin={onGuestJoin}
          onClose={() => setIsCountdownOpen(false)}
          onStartNow={onStartNow}
        />
      ) : null}
    </>
  );
}
