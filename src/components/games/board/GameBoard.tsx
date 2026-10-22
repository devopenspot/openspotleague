"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GameTransitionLoader } from "@/components/feedback/GameTransitionLoader";
import { GameBoardActionStatusModal } from "./GameBoardActionStatusModal";
import { useGameAction } from "@/components/games/hooks/useGameAction";
import { useGameRealtime } from "@/components/games/hooks/useGameRealtime";
import { useLocationVerification } from "@/components/games/hooks/useLocationVerification";
import { loadOrCreateGuestToken, normalizeGuestName } from "@/lib/games/guest";
import { deriveGameCapabilities } from "@/lib/games/capabilities";
import { showToast } from "@/hooks/ui/useToast";
import { ChallengeGameBoard } from "./ChallengeGameBoard";
import { ChallengeSettingsModal } from "@/components/games/shared/ChallengeSettingsModal";
import { AwardDialog } from "@/components/games/award/AwardDialog";
import { PanelShell, PanelScreenBezel } from "./panel/PanelShell";
import { GameBoardControls } from "./GameBoardControls";
import type { TrickLevel } from "@/lib/schemas/game";

const MAX_ALTERNATIVE_TRICKS = 3;

export function GameBoard({
  gameId: propGameId,
  userId,
  shareCode,
}: {
  gameId?: string;
  userId: string | null;
  shareCode?: string;
}) {
  const routeParams = useParams<{ id: string }>();
  const gameId = propGameId ?? routeParams?.id ?? "";
  const router = useRouter();
  const authenticated = userId !== null;
  const [guestName, setGuestName] = useState(() => {
    if (typeof sessionStorage === "undefined") return "";
    return sessionStorage.getItem("openspot-guest-name") ?? "";
  });
  const [guestJoinError, setGuestJoinError] = useState<string | null>(null);
  useEffect(() => {
    if (!authenticated) loadOrCreateGuestToken();
  }, [authenticated]);
  const { game, connection, error, setError, latestGameRef, refreshGameState } =
    useGameRealtime(gameId, shareCode, { authenticated });
  const { action, busy } = useGameAction({
    gameId,
    latestGameRef,
    refreshGameState,
    setError,
    authenticated,
  });
  const { locationPending, locationPermission, verifyLocation } =
    useLocationVerification({
      game,
      latestGameRef,
      action,
      setError,
    });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [alternativeTrickState, setAlternativeTrickState] = useState<{
    roundKey: string;
    ids: string[];
  }>({ roundKey: "none", ids: [] });
  const previousPlayerCount = useRef<number | null>(null);
  const previousStatus = useRef<string | null>(null);
  const [awardOpen, setAwardOpen] = useState(false);
  const awardKeyRef = useRef<string | null>(null);

  const awardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentRoundKey = game?.currentRound?.id ?? "none";
  const alternativeTrickIds =
    alternativeTrickState.roundKey === currentRoundKey
      ? alternativeTrickState.ids
      : [];
  const alternativeTrickCount = alternativeTrickIds.length;

  // Declared before the main [game] effect on purpose: effects run in
  // declaration order, so on mount/game change this reset runs first and
  // never cancels the timer the main effect schedules afterwards.
  useEffect(() => {
    // reset award dialog when navigating to a different game
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAwardOpen(false);
    awardKeyRef.current = null;
    if (awardTimeoutRef.current) {
      clearTimeout(awardTimeoutRef.current);
      awardTimeoutRef.current = null;
    }
  }, [game?.id]);

  useEffect(() => {
    return () => {
      awardKeyRef.current = null;
      if (awardTimeoutRef.current) {
        clearTimeout(awardTimeoutRef.current);
        awardTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!game) return;
    const prevStatus = previousStatus.current;
    if (
      previousPlayerCount.current !== null &&
      game.players.length > previousPlayerCount.current
    ) {
      showToast("New Rider Dropped In!", "info");
    }
    if (
      prevStatus !== null &&
      prevStatus !== game.status &&
      game.status === "cancelled"
    ) {
      const isSolo = game.trainingVariant === "solo";
      showToast(
        isSolo
          ? "Run Finished — See You Next Session!"
          : "Session Closed — Crew Headed Out.",
        "info",
      );
    }
    if (
      prevStatus !== null &&
      prevStatus !== game.status &&
      game.status === "complete"
    ) {
      showToast("That's a Wrap — Results Are In!", "success");
    }

    const isTerminal =
      game.status === "complete" || game.status === "cancelled";
    const hasLedger = (game.stageLedger?.length ?? 0) > 0;
    const transitioned =
      prevStatus !== null && prevStatus !== game.status && isTerminal;
    const reEntry = prevStatus === null && isTerminal;
    if ((transitioned || reEntry) && hasLedger) {
      const storageKey = `award-dialog:dismissed:${game.id}`;
      let dismissed: boolean;
      try {
        dismissed =
          typeof sessionStorage !== "undefined" &&
          sessionStorage.getItem(storageKey) === "1";
      } catch {
        dismissed = false;
      }
      if (!dismissed && awardKeyRef.current !== game.id) {
        awardKeyRef.current = game.id;
        // The timer lives in a ref (not effect cleanup) so a realtime update
        // arriving within the delay does not cancel it. It is cleared on
        // unmount or when the game id changes (effects above).
        if (awardTimeoutRef.current) clearTimeout(awardTimeoutRef.current);
        awardTimeoutRef.current = setTimeout(() => {
          setAwardOpen(true);
          awardTimeoutRef.current = null;
        }, 350);
      }
    }

    previousPlayerCount.current = game.players.length;
    previousStatus.current = game.status;
  }, [game]);

  if (!game) {
    if (error) {
      return (
        <div className="flex min-h-0 flex-1 flex-col bg-background px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 lg:px-10 lg:pb-4">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex items-center justify-between gap-2 px-1 py-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-error"
                  aria-hidden
                />
                Control Deck — Offline
              </span>
              <button
                type="button"
                onClick={() => router.push("/games")}
                className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-3 font-display text-[11px] font-bold uppercase tracking-[0.05em] hover:bg-surface-container-highest"
              >
                Back to challenges
              </button>
            </div>
            <PanelShell>
              <div className="p-2 sm:p-3">
                <PanelScreenBezel label="Signal Lost">
                  <div
                    role="alert"
                    className="bg-error-container px-4 py-6 sm:px-6"
                  >
                    <p className="font-display text-sm font-bold text-on-error-container">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void refreshGameState().catch(() => undefined)
                      }
                      className="mt-3 min-h-11 rounded-full border border-error bg-error px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-error hover:bg-error/90 focus-visible:outline-2 focus-visible:outline-error focus-visible:outline-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                </PanelScreenBezel>
              </div>
            </PanelShell>
          </div>
        </div>
      );
    }
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col bg-background px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 lg:px-10 lg:pb-4">
          <div className="mx-auto w-full max-w-7xl">
            <div className="flex items-center justify-between gap-2 px-1 py-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                <span
                  className="h-1.5 w-1.5 -dot rounded-full bg-primary"
                  aria-hidden
                />
                Control Deck — Syncing
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-secondary">
                Loading session
              </span>
            </div>
            <PanelShell>
              <div className="p-2 sm:p-3">
                <PanelScreenBezel label="Tuning Feed">
                  <div className="flex items-center justify-center px-6 py-16">
                    <span
                      className="h-6 w-6 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
                      aria-hidden
                    />
                  </div>
                </PanelScreenBezel>
              </div>
            </PanelShell>
          </div>
        </div>
        <GameTransitionLoader isOpen variant="loading" />
      </>
    );
  }
  const current = game.currentRound;
  const isHost = game.viewerIsHost;
  const capabilities = deriveGameCapabilities(
    {
      mode: game.mode,
      ruleMode: game.ruleMode,
      gameFormat: game.gameFormat,
      trainingVariant: game.trainingVariant,
      status: game.status,
      scheduledStartAt: game.scheduledStartAt
        ? new Date(game.scheduledStartAt)
        : null,
      currentChallengerPlayerId: game.currentChallengerPlayerId,
      players: game.players,
      currentRound: current
        ? {
            status: current.status,
            challengerPlayerId: current.challengerPlayerId,
            eligiblePlayerIds: current.eligiblePlayerIds,
            requiredResponsePlayerIds: current.requiredResponsePlayerIds,
            attempts: current.attempts,
            verifications: current.verifications,
          }
        : null,
    },
    { playerId: game.viewerPlayerId, isHost, authenticated },
    new Date(),
  );
  const isCurrentLeader =
    game.viewerPlayerId !== null &&
    game.viewerPlayerId === game.currentChallengerPlayerId &&
    current?.challengerPlayerId === game.viewerPlayerId;
  const canConfigureChallenge =
    isCurrentLeader &&
    (capabilities.canSelectSpotType || capabilities.canSelectLevel);
  async function submitChallengeSettings(settings: {
    spotType: string;
    level: TrickLevel;
  }): Promise<void> {
    if (!current || !canConfigureChallenge) return;
    const result = await action(
      `/rounds/${current.id}/challenge-settings`,
      settings,
    );
    if (result?.ok) setSettingsModalOpen(false);
  }

  async function proposeCategories(categories: string[]): Promise<void> {
    const result = await action("/categories/propose", { categories });
    if (result?.ok && game?.trainingVariant === "solo")
      setSettingsModalOpen(false);
  }

  async function voteCategories(accept: boolean): Promise<void> {
    await action("/categories/vote", { accept });
  }

  async function retrieveAlternativeTrick(): Promise<void> {
    if (!current || alternativeTrickCount >= MAX_ALTERNATIVE_TRICKS) return;
    const rejectedTrickId = current.trickId;
    const excludedTrickIds = [current.trickId, ...alternativeTrickIds].filter(
      (trickId): trickId is string => Boolean(trickId),
    );
    const result = await action(`/rounds/${current.id}/next-trick`, {
      excludedTrickIds,
    });
    const trick = result?.ok ? result.data?.trick : undefined;
    if (!trick) return;

    // Persisted on server; track rejected trick ids per leader per round for limit
    if (rejectedTrickId) {
      setAlternativeTrickState((state) => {
        const ids = state.roundKey === currentRoundKey ? state.ids : [];
        return {
          roundKey: currentRoundKey,
          ids: [...ids, rejectedTrickId],
        };
      });
    }
  }

  function submitGuestJoin() {
    const name = normalizeGuestName(guestName);
    if (!name) {
      setGuestJoinError("Pick a Name — 1 to 30 Characters.");
      return;
    }
    sessionStorage.setItem("openspot-guest-name", name);
    setGuestName(name);
    setGuestJoinError(null);
    joinLobby();
  }

  function joinLobby() {
    const effectiveShareCode = shareCode || game?.shareCode;
    if (!effectiveShareCode) return;
    void action("/join", { shareCode: effectiveShareCode });
  }

  const alternativeTricksRemaining = Math.max(
    0,
    MAX_ALTERNATIVE_TRICKS - alternativeTrickCount,
  );
  const boardResultAction =
    current && capabilities.canSubmitChallenge
      ? {
          label: "How'd It Go?",
          onSelect: (result: "landed" | "failed") => {
            void action(`/rounds/${current.id}/challenger-result`, { result });
          },
        }
      : current && capabilities.canSubmitResponse
        ? {
            label: "Your Call",
            onSelect: (result: "landed" | "failed") => {
              void action(`/rounds/${current.id}/attempt`, { result });
            },
          }
        : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 lg:px-10 lg:pb-4">
      <GameBoardControls
        game={game}
        connection={connection}
        authenticated={authenticated}
        busy={busy}
        locationPending={locationPending}
        locationPermission={locationPermission}
        capabilities={capabilities}
        canConfigureChallenge={canConfigureChallenge}
        settingsModalOpen={settingsModalOpen}
        guestName={guestName}
        guestJoinError={guestJoinError}
        onGuestNameChange={setGuestName}
        onGuestJoin={submitGuestJoin}
        onVerifyLocation={() => void verifyLocation()}
        onChallengeResult={(result) => {
          if (!current) return;
          void action(`/rounds/${current.id}/challenger-result`, {
            result,
          });
        }}
        alternativeTricksRemaining={alternativeTricksRemaining}
        onNextTrick={() => void retrieveAlternativeTrick()}
        onAttemptResult={(result) => {
          if (!current) return;
          void action(`/rounds/${current.id}/attempt`, { result });
        }}
        onJoinLobby={joinLobby}
        onStartLobby={() => void action("/start")}
        onStartNow={() => void action("/start", { startNow: true })}
        onTrainAlone={() => void action("/train-alone")}
        onCancelLobby={() => void action("/cancel")}
        onLeaveLobby={() => void action("/leave")}
        onCancelActive={() => void action("/cancel")}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onBackToChallenges={() => router.push("/games")}
        onViewResults={() => setAwardOpen(true)}
      />
      <div
        className={`mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col overflow-hidden ${game.trainingVariant !== "solo" ? "mb-14 md:mb-0" : ""}`}
      >
        <PanelShell className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* main CRT screen — mobile: full width stacked, desktop: inlaid — flex viewport */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest p-1.5 sm:p-2">
            <PanelScreenBezel className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <ChallengeGameBoard
                  game={game}
                  variant="panel"
                  resultAction={boardResultAction}
                  canAdvanceToNextTrick={capabilities.canAdvanceToNextTrick}
                  alternativeTricksRemaining={alternativeTricksRemaining}
                  onNextTrick={() => void retrieveAlternativeTrick()}
                  busy={busy}
                />
              </div>
            </PanelScreenBezel>
          </div>
        </PanelShell>

        {/* overlays stay outside chassis so portals layer correctly */}
        <GameBoardActionStatusModal
          isOpen={locationPending}
          busy={busy}
          locationPending={locationPending}
          settingsModalOpen={settingsModalOpen}
          game={game}
        />
        <ChallengeSettingsModal
          key={
            settingsModalOpen
              ? `${game.id}:${game.version}:${current?.id ?? "next"}:${game.nextSpotType}:${game.nextLevel ?? "none"}:${(game.selectedCategories ?? []).join(",")}:${game.pendingCategoryProposal?.categories.join(",") ?? "none"}:${game.pendingCategoryProposal?.votes.map((v) => v.vote).join(",") ?? "no"}`
              : "closed"
          }
          isOpen={settingsModalOpen && canConfigureChallenge}
          onClose={() => setSettingsModalOpen(false)}
          spotTypes={game.availableSpotTypes}
          initialSpotType={game.nextSpotType}
          initialLevel={game.nextLevel}
          selectedCategories={game.selectedCategories ?? null}
          pendingProposal={game.pendingCategoryProposal ?? null}
          players={game.players}
          viewerPlayerId={game.viewerPlayerId}
          disciplineSlug={game.disciplineSlug}
          liveChallenge={
            current?.status === "challenge_open" ||
            current?.status === "collecting_results"
          }
          busy={busy}
          onSubmit={submitChallengeSettings}
          onCategoriesPropose={proposeCategories}
          onCategoriesVote={voteCategories}
        />
        <AwardDialog
          isOpen={awardOpen}
          onClose={() => {
            try {
              sessionStorage.setItem(`award-dialog:dismissed:${game.id}`, "1");
            } catch {
              // ignore storage errors (private mode, quota)
            }
            setAwardOpen(false);
          }}
          game={game}
        />
      </div>
    </div>
  );
}
