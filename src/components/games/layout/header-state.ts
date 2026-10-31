import type { GameCapabilities } from "@/lib/games/capabilities";
import { isLobbyReadyForStart } from "@/lib/games/lobby";
import type { GameState } from "@/lib/schemas/game";
import type { BadgeTone } from "@/components/ui/Badge";

export type LocationPermission =
  | "unknown"
  | "granted"
  | "prompt"
  | "denied"
  | "unavailable";

export type Result = "landed" | "failed";

const LIVE_CHALLENGE_STATUSES = new Set([
  "challenge_open",
  "collecting_results",
]);

export const EMPTY_CAPABILITIES: GameCapabilities = {
  canJoin: false,
  canLeave: false,
  canStart: false,
  canStartNow: false,
  canTrainAlone: false,
  canCancel: false,
  canVerifyLocation: false,
  canSelectSpotType: false,
  canSelectLevel: false,
  canSubmitChallenge: false,
  canSubmitResponse: false,
  canAdvanceToNextTrick: false,
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Basic",
  2: "Intermediate",
  3: "Advanced",
  4: "Expert",
  5: "Master",
};

/**
 * Pure derivations for the game Header — everything the sticky bar, action
 * zone, and terminal banner render is computed here from the game snapshot.
 */
export function deriveHeaderState(
  game: GameState | null,
  capabilities: GameCapabilities,
) {
  const current = game?.currentRound;
  const currentPlayer = game?.players.find(
    (player) => player.id === game?.viewerPlayerId,
  );
  const leader = game?.players.find(
    (player) => player.id === game?.currentChallengerPlayerId,
  );
  const effectiveLevel = (current?.trickLevel ?? game?.nextLevel ?? null) as
    | number
    | null;
  const levelLabel = effectiveLevel
    ? (LEVEL_LABELS[effectiveLevel] ?? null)
    : null;
  const selectedCats = (game?.selectedCategories ?? null) as
    | readonly string[]
    | null;
  const isCategoriesAll = !selectedCats || selectedCats.length === 0;
  const categoriesDisplay = isCategoriesAll ? "All" : selectedCats!.join(", ");
  const pendingProposal = game?.pendingCategoryProposal ?? null;
  const hasPendingCategories = Boolean(pendingProposal);
  const isComplete = game?.status === "complete";
  const isTerminal = isComplete || game?.status === "cancelled";
  const activeRiderCount =
    game?.players.filter((player) => player.status === "active").length ?? 0;
  const verifiedRiderCount =
    current?.verifications?.filter(
      (verification) =>
        verification.status === "verified" &&
        game?.players.some(
          (player) =>
            player.id === verification.playerId && player.status === "active",
        ),
    ).length ?? 0;
  const isLiveChallenge = current
    ? LIVE_CHALLENGE_STATUSES.has(current.status)
    : false;
  const canJoinLobby = Boolean(game && capabilities.canJoin);
  const canStartLobby = Boolean(game && capabilities.canStart);
  const canTrainAlone = Boolean(game && capabilities.canTrainAlone);
  const canCancelLobby = Boolean(
    game && capabilities.canCancel && game.status === "lobby",
  );
  const canLeaveLobby = Boolean(
    game && capabilities.canLeave && game.status === "lobby",
  );
  const canCancelActive = Boolean(
    game && capabilities.canCancel && game.status === "active",
  );
  const canCancel = canCancelLobby || canCancelActive;

  const lobbyReady = game
    ? isLobbyReadyForStart(
        game.mode,
        game.players.length,
        activeRiderCount,
        verifiedRiderCount,
      )
    : false;
  const roundNotice =
    current?.status === "no_compatible_trick"
      ? (current.blockedReason ??
        "No Trick Fits This Spot and Level — Leader, Switch It Up To Keep Riding!")
      : current?.status === "paused"
        ? "Round Paused — Need At Least Two Checked-In Riders. Hit Check In To Keep Riding!"
        : current?.verifications?.some(
              (verification) =>
                verification.playerId === game?.viewerPlayerId &&
                verification.status === "unavailable",
            )
          ? "You're Sitting This Round Out — You'll Be Back In Next Round!"
          : null;

  const isParticipant = Boolean(
    currentPlayer &&
    currentPlayer.status !== "left" &&
    game?.players.some((p) => p.id === game?.viewerPlayerId),
  );
  const canSubmitThisRound = Boolean(
    capabilities.canSubmitChallenge || capabilities.canSubmitResponse,
  );
  const isWaitingForOthers = Boolean(
    game &&
    game.status === "active" &&
    isLiveChallenge &&
    isParticipant &&
    !canSubmitThisRound &&
    game.trainingVariant !== "solo" &&
    !isTerminal,
  );
  const pendingResponseIds =
    current?.status === "collecting_results" &&
    Array.isArray(current.requiredResponsePlayerIds) &&
    Array.isArray(current.attempts)
      ? current.requiredResponsePlayerIds.filter(
          (pid) => !current.attempts.some((a) => a.playerId === pid),
        )
      : [];
  const pendingChallenge =
    current?.status === "challenge_open" &&
    !canSubmitThisRound &&
    current.challengerPlayerId
      ? ([current.challengerPlayerId].filter(Boolean) as string[])
      : [];
  const pendingIds = isWaitingForOthers
    ? current?.status === "challenge_open"
      ? pendingChallenge
      : pendingResponseIds
    : [];
  const pendingNames = pendingIds
    .map(
      (pid) => game?.players.find((p) => p.id === pid)?.displayName ?? "Rider",
    )
    .slice(0, 4);

  const winner = game?.players.find(
    (player) => player.id === game?.winnerPlayerId,
  );
  const viewerWon = isComplete && winner?.id === game?.viewerPlayerId;
  const terminalTone: Extract<BadgeTone, "success" | "info" | "danger"> =
    game?.status === "cancelled" ? "danger" : viewerWon ? "success" : "info";
  const terminalLabel =
    game?.status === "cancelled" ? "Session Status" : "Final Result";
  const terminalTitle =
    game?.status === "cancelled"
      ? "Session Closed"
      : viewerWon
        ? "You Won!"
        : "Session Complete";
  const terminalDescription =
    game?.status === "cancelled"
      ? "This Session Was Closed."
      : winner
        ? `${winner.displayName} Win — Check The Final Scores Below.`
        : "That's A Wrap — Check The Final Scores Below.";

  return {
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
    pendingIds,
    pendingNames,
    pendingCount: pendingIds.length,
    canSubmitThisRound,
  };
}
