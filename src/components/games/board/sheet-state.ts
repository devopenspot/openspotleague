import type { SheetDetent } from "@/components/feedback/BottomSheet";
import {
  deriveHeaderState,
  type LocationPermission,
} from "@/components/games/layout/header-state";
import type { GameCapabilities } from "@/lib/games/capabilities";
import { PLAYER_LIMITS } from "@/lib/games/definitions";
import type { GameState } from "@/lib/schemas/game";

export const GAME_SHEET_PEEK_PX = 132;

export type GameSheetActionId =
  | "join"
  | "dropIn"
  | "dropInNow"
  | "rideSolo"
  | "share"
  | "checkIn"
  | "changeLine"
  | "voteAccept"
  | "voteReject"
  | "results"
  | "runAgain"
  | "back";

export type GameSheetSessionActionId =
  | "invite"
  | "changeLine"
  | "leave"
  | "cancel"
  | "back";

export type GameSheetAction = {
  id: GameSheetActionId;
  label: string;
  tone: "primary" | "secondary";
  disabled?: boolean;
};

export type GameSheetPhase =
  | "lobby"
  | "check-in"
  | "turn"
  | "vote"
  | "waiting"
  | "set-line"
  | "watching"
  | "terminal";

export type GameSheetContext = {
  authenticated: boolean;
  locationPending: boolean;
  locationPermission: LocationPermission;
  canConfigureChallenge: boolean;
};

export type GameSheetView = {
  phase: GameSheetPhase;
  status: string;
  detail: string | null;
  /** The QR is on screen, so nobody has to type a code. */
  showInvite: boolean;
  showResults: boolean;
  /** Pinned to the visible edge, primary last so it sits under the thumb. */
  actions: GameSheetAction[];
  sessionActions: { id: GameSheetSessionActionId; label: string }[];
  defaultDetent: SheetDetent;
  /** A change means the default detent applies again. */
  detentKey: string;
};

function checkInLabel(permission: LocationPermission, pending: boolean) {
  if (pending) return "Checking You In…";
  if (permission === "denied") return "Fix Location To Ride";
  if (permission === "unavailable") return "Try Again";
  return "Check In At Spot";
}

/** What a scheduled lobby is still waiting for. */
export function lobbyReadiness(game: GameState) {
  const activeRiders = game.players.filter(
    (player) => player.status === "active",
  );
  const verified =
    game.currentRound?.verifications.filter(
      (verification) =>
        verification.status === "verified" &&
        activeRiders.some((player) => player.id === verification.playerId),
    ).length ?? 0;
  if (activeRiders.length < PLAYER_LIMITS.min) {
    return "Need One More Rider To Drop In!";
  }
  if (verified < activeRiders.length) {
    return "Everyone Needs To Check In At The Spot Before The Host Can Drop In.";
  }
  return "Riders Are Ready — Host Can Drop In Anytime!";
}

function sessionActionsFor(
  game: GameState,
  header: ReturnType<typeof deriveHeaderState>,
  canConfigureChallenge: boolean,
): GameSheetView["sessionActions"] {
  const actions: GameSheetView["sessionActions"] = [];
  if (!header.isTerminal) actions.push({ id: "invite", label: "Invite A Rider" });
  if (canConfigureChallenge && !header.isTerminal) {
    actions.push({ id: "changeLine", label: "Change Line" });
  }
  if (header.canLeaveLobby) actions.push({ id: "leave", label: "Step Out" });
  if (header.canCancelActive) {
    actions.push({
      id: "cancel",
      label:
        game.trainingVariant === "solo" ? "Finish Run" : "Finish Challenge",
    });
  } else if (header.canCancelLobby) {
    actions.push({ id: "cancel", label: "End Session" });
  }
  actions.push({ id: "back", label: "Back To Games" });
  return actions;
}

/**
 * The single next step for this viewer. Every phase and role resolves here so
 * the sheet never has to work out what a rider can do.
 */
export function deriveGameSheetView(
  game: GameState,
  capabilities: GameCapabilities,
  context: GameSheetContext,
): GameSheetView {
  const header = deriveHeaderState(game, capabilities);
  const { current } = header;
  const sessionActions = sessionActionsFor(
    game,
    header,
    context.canConfigureChallenge,
  );
  const roundKey = current?.id ?? "none";
  const isScheduledLobby =
    game.status === "lobby" && Boolean(game.scheduledStartAt);
  const showInvite =
    game.status === "lobby" &&
    game.viewerPlayerId !== null &&
    game.players.filter((player) => player.status === "active").length <
      PLAYER_LIMITS.max;
  const needsCheckIn =
    capabilities.canVerifyLocation && context.locationPermission !== "granted";
  const checkInAgain =
    capabilities.canVerifyLocation &&
    context.locationPermission === "granted" &&
    !context.locationPending;

  const view = (
    phase: GameSheetPhase,
    status: string,
    rest: Partial<
      Pick<GameSheetView, "detail" | "showResults" | "actions" | "defaultDetent">
    > = {},
  ): GameSheetView => ({
    phase,
    status,
    detail:
      rest.detail ??
      header.roundNotice ??
      (isScheduledLobby ? lobbyReadiness(game) : null),
    showInvite,
    showResults: rest.showResults ?? false,
    actions: rest.actions ?? [],
    sessionActions,
    defaultDetent: rest.defaultDetent ?? (showInvite ? "half" : "peek"),
    detentKey: `${roundKey}:${phase}`,
  });

  if (header.isTerminal) {
    const hasResults = (game.stageLedger?.length ?? 0) > 0;
    return view("terminal", header.terminalTitle, {
      detail: header.terminalDescription,
      actions: [
        ...(hasResults
          ? [{ id: "results", label: "Results", tone: "secondary" } as const]
          : []),
        header.isComplete
          ? ({ id: "runAgain", label: "Run It Again", tone: "primary" } as const)
          : ({ id: "back", label: "Back", tone: "primary" } as const),
      ],
    });
  }

  if (game.status === "lobby") {
    if (header.canJoinLobby) {
      return view("lobby", "Join this session", {
        actions: [{ id: "join", label: "Join", tone: "primary" }],
        defaultDetent: context.authenticated ? "peek" : "half",
      });
    }
    if (needsCheckIn) {
      return view("check-in", "Check in at the spot", {
        actions: [
          {
            id: "checkIn",
            label: checkInLabel(
              context.locationPermission,
              context.locationPending,
            ),
            tone: "primary",
            disabled: context.locationPending,
          },
        ],
      });
    }
    if (capabilities.canStartNow && game.scheduledStartAt) {
      return view("lobby", "Everyone's checked in", {
        actions: [{ id: "dropInNow", label: "Drop In Now", tone: "primary" }],
      });
    }
    if (header.canStartLobby) {
      return view("lobby", "Rider joined", {
        actions: [
          {
            id: "dropIn",
            label: "Drop In",
            tone: "primary",
            disabled: !header.lobbyReady,
          },
        ],
      });
    }
    if (header.canTrainAlone) {
      return view("lobby", "Waiting for a rider", {
        actions: [
          { id: "share", label: "Share Link", tone: "secondary" },
          { id: "rideSolo", label: "Ride Solo", tone: "primary" },
        ],
      });
    }
    return view(
      "lobby",
      game.viewerIsHost ? "Waiting for a rider" : "Waiting for the host",
      {
        actions: game.viewerIsHost
          ? [{ id: "share", label: "Share Link", tone: "secondary" }]
          : [],
      },
    );
  }

  if (needsCheckIn || context.locationPending) {
    return view(
      "check-in",
      context.locationPending ? "Checking you in…" : "Check in at the spot",
      {
        actions: needsCheckIn
          ? [
              {
                id: "checkIn",
                label: checkInLabel(
                  context.locationPermission,
                  context.locationPending,
                ),
                tone: "primary",
                disabled: context.locationPending,
              },
            ]
          : [],
      },
    );
  }

  if (checkInAgain) {
    return view("check-in", "Check in at the spot", {
      actions: [{ id: "checkIn", label: "Check In Again", tone: "primary" }],
    });
  }

  if (header.canSubmitThisRound) {
    const status =
      game.trainingVariant === "solo"
        ? "Your run"
        : capabilities.canSubmitChallenge
          ? "Your turn — set the line"
          : "Your turn — match it";
    return view("turn", status, { showResults: true, defaultDetent: "half" });
  }

  const proposal = game.pendingCategoryProposal;
  const viewerVote = proposal?.votes.find(
    (vote) => vote.playerId === game.viewerPlayerId,
  );
  if (proposal && viewerVote?.vote === "pending") {
    const proposer = game.players.find(
      (player) => player.id === proposal.proposerPlayerId,
    );
    return view(
      "vote",
      `${proposer?.displayName ?? "A rider"} wants new categories`,
      {
        detail:
          proposal.categories.length === 0
            ? "All categories"
            : proposal.categories.join(", "),
        actions: [
          { id: "voteReject", label: "Reject", tone: "secondary" },
          { id: "voteAccept", label: "Accept", tone: "primary" },
        ],
        defaultDetent: "half",
      },
    );
  }

  if (header.isWaitingForOthers) {
    const names = header.pendingNames.join(", ");
    return view("waiting", names ? `Waiting on ${names}` : "Waiting for results");
  }

  if (context.canConfigureChallenge) {
    return view("set-line", "Set the line", {
      actions: [{ id: "changeLine", label: "Change Line", tone: "primary" }],
      defaultDetent: "half",
    });
  }

  return view("watching", game.viewerPlayerId ? "Stand by" : "Watching this session");
}

export type DetentState = {
  key: string;
  roundKey: string;
  detent: SheetDetent;
  /** The rider moved the sheet during this round, so state stays out of it. */
  userChose: boolean;
};

export function initialDetentState(
  view: Pick<GameSheetView, "detentKey" | "defaultDetent">,
): DetentState {
  return {
    key: view.detentKey,
    roundKey: view.detentKey.split(":")[0] ?? "none",
    detent: view.defaultDetent,
    userChose: false,
  };
}

/** Applies a new default detent, unless the rider chose one this round. */
export function nextDetentState(
  previous: DetentState,
  view: Pick<GameSheetView, "detentKey" | "defaultDetent">,
): DetentState {
  if (previous.key === view.detentKey) return previous;
  const next = initialDetentState(view);
  if (previous.userChose && previous.roundKey === next.roundKey) {
    return { ...previous, key: view.detentKey };
  }
  return next;
}
