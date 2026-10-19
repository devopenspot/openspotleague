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
} from "./header-state";
import {
  CancelSessionDialog,
  DRAWER_ID,
  GameShareDrawer,
  GameStatusStrip,
  TerminalResultBar,
} from "./header-parts";
import { TrickActionDrawer } from "./TrickActionDrawer";
import {
  hasSeenShareOnboarding,
  markShareOnboardingSeen,
} from "./share-onboarding";

const noop = () => undefined;

/**
 * @deprecated Use `GameBoardControls` (`src/components/games/board/GameBoardControls.tsx`) — Header is kept only for `game={null}` offline states and tests.
 */
export function Header({
  game,
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
  error?: string | null;
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
    if (!game?.id || !isScheduledChallengeLobby) {
      return;
    }
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

  // auto-open trick panel when a new trick is delivered (active or waiting)
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

  return (
    <>
      <header
        id="game-header"
        className="sticky top-0 z-40 -mx-5 mb-6 w-[calc(100%+2.5rem)] border-b border-outline-variant bg-surface/95 backdrop-blur-sm sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-10 lg:w-[calc(100%+5rem)]"
      >
        <div className="px-5 py-3 sm:px-6 sm:py-4 lg:px-10">
          <div className="mx-auto flex min-h-11 max-w-7xl flex-wrap items-center gap-x-3 gap-y-3 lg:flex-nowrap">
            {game ? (
              <>
                <h2 className="order-1 shrink-0 font-display text-sm font-bold leading-none tracking-tight text-on-surface lg:order-none">
                  {game.gameName}
                </h2>
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
                <div className="mx-auto flex shrink-0 items-center gap-2">
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
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary bg-primary px-3 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                    >
                      <Settings2 size={17} aria-hidden="true" />
                      <span className="hidden sm:inline">
                        {isLiveChallenge ? "Switch It Up" : "Set The Line"}
                      </span>
                    </button>
                  ) : null}

                  {isScheduledChallengeLobby && !isCountdownOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsCountdownOpen(true)}
                      className="inline-flex min-h-11 items-center rounded-full border border-primary/40 bg-primary-container px-3 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary-container transition-[background-color,transform] hover:bg-primary/80 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
                    >
                      Countdown
                    </button>
                  ) : null}

                  <button
                    type="button"
                    aria-label="Open game controls"
                    aria-controls={DRAWER_ID}
                    aria-expanded={isDrawerOpen}
                    onClick={openGameControls}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
                  >
                    Share
                    <Share size={17} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <span className="hidden font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary sm:inline">
                  Loading
                </span>
                <button
                  type="button"
                  aria-label="Open game controls"
                  aria-controls={DRAWER_ID}
                  aria-expanded={isDrawerOpen}
                  onClick={openGameControls}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
                >
                  <Share size={17} aria-hidden="true" />
                </button>
              </div>
            )}

            {!isTerminal ? (
              <div className="min-w-0 lg:justify-self-end">
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
                    />
                  ) : null}

                  {canJoinLobby && authenticated ? (
                    <button
                      type="button"
                      onClick={onJoinLobby}
                      disabled={busy}
                      className="min-h-9 rounded-full border border-primary bg-primary px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                    >
                      {busy ? "Joining Crew…" : "Join Crew"}
                    </button>
                  ) : null}

                  {canStartLobby ? (
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

                  {canTrainAlone ? (
                    <button
                      type="button"
                      onClick={onTrainAlone}
                      disabled={busy}
                      className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                    >
                      {busy ? "Starting Solo…" : "Ride Solo"}
                    </button>
                  ) : null}

                  {capabilities.canVerifyLocation &&
                  locationPermission !== "granted" ? (
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

                  {capabilities.canVerifyLocation &&
                  locationPermission === "granted" &&
                  !locationPending ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={onVerifyLocation}
                      className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
                    >
                      Check In Again
                    </button>
                  ) : null}

                  {capabilities.canVerifyLocation &&
                  locationPermission === "denied" ? (
                    <LocationBlockedCallout
                      variant="banner"
                      onRetry={onVerifyLocation}
                      className="w-full max-w-xl"
                    />
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
                        className={`h-1.5 w-1.5 rounded-full ${resultAction ? "bg-on-primary" : "bg-permission-pending -dot"}`}
                        aria-hidden
                      />
                      {resultAction
                        ? "Your Turn — Open Panel"
                        : `Waiting · ${pendingCount} rider${pendingCount === 1 ? "" : "s"}`}
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
              </div>
            ) : null}
          </div>
        </div>

        {roundNotice ? (
          <p
            role="status"
            className="mx-auto mt-3 max-w-7xl rounded-[8px] border border-outline-variant bg-surface-container-low px-3 py-2.5 text-sm leading-5 text-on-surface-variant sm:px-4 lg:px-5"
          >
            {roundNotice}
          </p>
        ) : null}

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
        ) : null}
      </header>

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
