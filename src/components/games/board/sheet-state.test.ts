import { describe, expect, it } from "vitest";
import {
  deriveGameSheetView,
  initialDetentState,
  nextDetentState,
  type GameSheetContext,
} from "@/components/games/board/sheet-state";
import { EMPTY_CAPABILITIES } from "@/components/games/layout/header-state";
import type { GameCapabilities } from "@/lib/games/capabilities";
import type { GameState } from "@/lib/schemas/game";

const context: GameSheetContext = {
  authenticated: true,
  locationPending: false,
  locationPermission: "unknown",
  canConfigureChallenge: false,
};

const game = {
  id: "game-1",
  status: "active",
  mode: "training",
  trainingVariant: "multiplayer",
  scheduledStartAt: null,
  viewerIsHost: false,
  viewerPlayerId: "rider",
  currentChallengerPlayerId: "leader",
  winnerPlayerId: null,
  stageLedger: [],
  pendingCategoryProposal: null,
  players: [
    { id: "leader", displayName: "Leader", status: "active" },
    { id: "rider", displayName: "Rider", status: "active" },
  ],
  currentRound: {
    id: "round-1",
    status: "collecting_results",
    challengerPlayerId: "leader",
    requiredResponsePlayerIds: ["rider"],
    attempts: [],
    verifications: [],
  },
} as unknown as GameState;

const lobby = {
  ...game,
  status: "lobby",
  viewerIsHost: true,
  currentRound: null,
} as unknown as GameState;

const can = (overrides: Partial<GameCapabilities>): GameCapabilities => ({
  ...EMPTY_CAPABILITIES,
  ...overrides,
});

const actionIds = (view: ReturnType<typeof deriveGameSheetView>) =>
  view.actions.map((action) => action.id);

describe("deriveGameSheetView", () => {
  it("offers a host alone Ride Solo and sharing, primary last", () => {
    const view = deriveGameSheetView(
      { ...lobby, players: [game.players[0]] } as GameState,
      can({ canTrainAlone: true }),
      context,
    );
    expect(view.phase).toBe("lobby");
    expect(view.status).toBe("Waiting for a rider");
    expect(actionIds(view)).toEqual(["share", "rideSolo"]);
    expect(view.actions.at(-1)?.tone).toBe("primary");
    expect(view.showInvite).toBe(true);
    expect(view.defaultDetent).toBe("half");
  });

  it("only shows the invite to a joined rider while there's a free spot", () => {
    const alone = { ...lobby, players: [game.players[0]] } as GameState;
    expect(deriveGameSheetView(alone, EMPTY_CAPABILITIES, context).showInvite).toBe(true);
    expect(deriveGameSheetView(lobby, EMPTY_CAPABILITIES, context).showInvite).toBe(false);
    expect(
      deriveGameSheetView(
        { ...alone, viewerPlayerId: null } as GameState,
        EMPTY_CAPABILITIES,
        context,
      ).showInvite,
    ).toBe(false);
    expect(deriveGameSheetView(game, EMPTY_CAPABILITIES, context).showInvite).toBe(false);
  });

  it("says what a scheduled lobby is still waiting for", () => {
    const scheduled = {
      ...lobby,
      mode: "challenge",
      scheduledStartAt: "2030-01-01T12:05:00.000Z",
      currentRound: { ...game.currentRound, status: "verifying_location" },
    } as unknown as GameState;

    expect(
      deriveGameSheetView(
        { ...scheduled, players: [game.players[0]] } as GameState,
        EMPTY_CAPABILITIES,
        context,
      ).detail,
    ).toBe("Need One More Rider To Drop In!");
    expect(deriveGameSheetView(scheduled, EMPTY_CAPABILITIES, context).detail).toMatch(
      /Everyone Needs To Check In/,
    );
    expect(
      deriveGameSheetView(
        {
          ...scheduled,
          currentRound: {
            ...scheduled.currentRound,
            verifications: [
              { playerId: "leader", status: "verified" },
              { playerId: "rider", status: "verified" },
            ],
          },
        } as unknown as GameState,
        EMPTY_CAPABILITIES,
        context,
      ).detail,
    ).toBe("Riders Are Ready — Host Can Drop In Anytime!");
  });

  it("offers Drop In once a rider has joined", () => {
    const view = deriveGameSheetView(
      {
        ...lobby,
        currentRound: game.currentRound,
      } as GameState,
      can({ canStart: true }),
      context,
    );
    expect(view.status).toBe("Rider joined");
    expect(actionIds(view)).toEqual(["dropIn"]);
  });

  it("lets a signed-in rider join in one tap from peek", () => {
    const view = deriveGameSheetView(
      { ...lobby, viewerIsHost: false, viewerPlayerId: null } as GameState,
      can({ canJoin: true }),
      context,
    );
    expect(actionIds(view)).toEqual(["join"]);
    expect(view.defaultDetent).toBe("peek");
  });

  it("opens to half for a guest, who has a name field to see", () => {
    const view = deriveGameSheetView(
      { ...lobby, viewerIsHost: false, viewerPlayerId: null } as GameState,
      can({ canJoin: true }),
      { ...context, authenticated: false },
    );
    expect(view.defaultDetent).toBe("half");
  });

  it("gives a signed-in rider a Join in a scheduled lobby", () => {
    const view = deriveGameSheetView(
      {
        ...lobby,
        mode: "challenge",
        scheduledStartAt: "2030-01-01T12:05:00.000Z",
        viewerIsHost: false,
        viewerPlayerId: null,
      } as unknown as GameState,
      can({ canJoin: true }),
      context,
    );
    expect(actionIds(view)).toEqual(["join"]);
  });

  it("shows Drop In Now to a ready host of a scheduled challenge", () => {
    const view = deriveGameSheetView(
      {
        ...lobby,
        mode: "challenge",
        scheduledStartAt: "2030-01-01T12:05:00.000Z",
      } as unknown as GameState,
      can({ canStartNow: true }),
      { ...context, locationPermission: "granted" },
    );
    expect(actionIds(view)).toEqual(["dropInNow"]);
  });

  it("asks for check-in in the lobby and while a round is paused", () => {
    const inLobby = deriveGameSheetView(
      { ...lobby, mode: "challenge" } as GameState,
      can({ canVerifyLocation: true }),
      { ...context, locationPermission: "prompt" },
    );
    expect(inLobby.phase).toBe("check-in");
    expect(inLobby.actions[0]?.label).toBe("Check In At Spot");

    const paused = deriveGameSheetView(
      {
        ...game,
        mode: "challenge",
        currentRound: { ...game.currentRound, status: "paused" },
      } as unknown as GameState,
      can({ canVerifyLocation: true }),
      { ...context, locationPermission: "prompt" },
    );
    expect(paused.phase).toBe("check-in");
    expect(paused.detail).toMatch(/Paused/);
  });

  it("names the recovery step when location is blocked", () => {
    const view = deriveGameSheetView(
      game,
      can({ canVerifyLocation: true }),
      { ...context, locationPermission: "denied" },
    );
    expect(view.actions[0]?.label).toBe("Fix Location To Ride");
  });

  it("shows GPS progress without blocking the sheet", () => {
    const view = deriveGameSheetView(
      game,
      can({ canVerifyLocation: true }),
      { ...context, locationPermission: "granted", locationPending: true },
    );
    expect(view.status).toBe("Checking you in…");
    expect(view.actions).toEqual([]);
  });

  it("offers Check In Again when permission is already granted", () => {
    const view = deriveGameSheetView(
      game,
      can({ canVerifyLocation: true }),
      { ...context, locationPermission: "granted" },
    );
    expect(view.actions[0]?.label).toBe("Check In Again");
  });

  it("opens the result buttons on the viewer's turn", () => {
    const leader = deriveGameSheetView(
      game,
      can({ canSubmitChallenge: true }),
      context,
    );
    expect(leader.phase).toBe("turn");
    expect(leader.showResults).toBe(true);
    expect(leader.status).toBe("Your turn — set the line");
    expect(leader.defaultDetent).toBe("half");

    const responder = deriveGameSheetView(
      game,
      can({ canSubmitResponse: true }),
      context,
    );
    expect(responder.status).toBe("Your turn — match it");
  });

  it("calls it a run in solo", () => {
    const view = deriveGameSheetView(
      { ...game, trainingVariant: "solo" } as GameState,
      can({ canSubmitChallenge: true }),
      context,
    );
    expect(view.status).toBe("Your run");
  });

  it("names who the viewer is waiting on, and stays out of the way", () => {
    const view = deriveGameSheetView(
      {
        ...game,
        viewerPlayerId: "leader",
        currentRound: { ...game.currentRound },
      } as unknown as GameState,
      EMPTY_CAPABILITIES,
      context,
    );
    expect(view.phase).toBe("waiting");
    expect(view.status).toBe("Waiting on Rider");
    expect(view.showResults).toBe(false);
    expect(view.defaultDetent).toBe("peek");
  });

  it("gives a non-leader a vote on a category proposal", () => {
    const view = deriveGameSheetView(
      {
        ...game,
        pendingCategoryProposal: {
          categories: ["flip"],
          proposerPlayerId: "leader",
          votes: [{ playerId: "rider", vote: "pending" }],
          createdAt: "2030-01-01T12:05:00.000Z",
        },
        currentRound: { ...game.currentRound, status: "selecting_level" },
      } as unknown as GameState,
      EMPTY_CAPABILITIES,
      context,
    );
    expect(view.phase).toBe("vote");
    expect(view.status).toBe("Leader wants new categories");
    expect(view.detail).toBe("flip");
    expect(actionIds(view)).toEqual(["voteReject", "voteAccept"]);
  });

  it("keeps a rider's own turn ahead of a pending vote", () => {
    const view = deriveGameSheetView(
      {
        ...game,
        pendingCategoryProposal: {
          categories: [],
          proposerPlayerId: "leader",
          votes: [{ playerId: "rider", vote: "pending" }],
          createdAt: "2030-01-01T12:05:00.000Z",
        },
      } as unknown as GameState,
      can({ canSubmitResponse: true }),
      context,
    );
    expect(view.phase).toBe("turn");
  });

  it("prompts the leader to set the line when no trick fits", () => {
    const view = deriveGameSheetView(
      {
        ...game,
        viewerPlayerId: "leader",
        currentRound: { ...game.currentRound, status: "no_compatible_trick" },
      } as unknown as GameState,
      EMPTY_CAPABILITIES,
      { ...context, canConfigureChallenge: true },
    );
    expect(view.phase).toBe("set-line");
    expect(actionIds(view)).toEqual(["changeLine"]);
    expect(view.detail).toMatch(/No Trick Fits/);
  });

  it("marks spectators as watching", () => {
    const view = deriveGameSheetView(
      { ...game, viewerPlayerId: null } as GameState,
      EMPTY_CAPABILITIES,
      context,
    );
    expect(view.status).toBe("Watching this session");
  });

  it("ends a completed game on Run It Again and a closed one on Back", () => {
    const complete = deriveGameSheetView(
      {
        ...game,
        status: "complete",
        currentRound: null,
        stageLedger: [{ id: "round-1" }],
      } as unknown as GameState,
      EMPTY_CAPABILITIES,
      context,
    );
    expect(complete.phase).toBe("terminal");
    expect(actionIds(complete)).toEqual(["results", "runAgain"]);

    const cancelled = deriveGameSheetView(
      { ...game, status: "cancelled", currentRound: null } as GameState,
      EMPTY_CAPABILITIES,
      context,
    );
    expect(cancelled.status).toBe("Session Closed");
    expect(actionIds(cancelled)).toEqual(["back"]);
  });

  it("keeps session actions out of the pinned row", () => {
    const view = deriveGameSheetView(
      game,
      can({ canSubmitChallenge: true, canCancel: true }),
      { ...context, canConfigureChallenge: true },
    );
    expect(view.sessionActions.map((action) => action.id)).toEqual([
      "invite",
      "changeLine",
      "cancel",
      "back",
    ]);
    expect(view.sessionActions[2]?.label).toBe("Finish Challenge");
  });

  it("labels the lobby session actions by role", () => {
    const rider = deriveGameSheetView(
      { ...lobby, viewerIsHost: false, currentRound: game.currentRound } as GameState,
      can({ canLeave: true, canCancel: true }),
      context,
    );
    expect(rider.sessionActions.map((action) => action.label)).toEqual([
      "Invite A Rider",
      "Step Out",
      "End Session",
      "Back To Games",
    ]);
  });
});

describe("nextDetentState", () => {
  const view = (detentKey: string, defaultDetent: "peek" | "half") => ({
    detentKey,
    defaultDetent,
  });

  it("opens to half when it becomes the rider's turn", () => {
    const state = initialDetentState(view("round-1:waiting", "peek"));
    expect(nextDetentState(state, view("round-1:turn", "half")).detent).toBe(
      "half",
    );
  });

  it("never overrides a choice made during the same round", () => {
    const chosen = {
      ...initialDetentState(view("round-1:waiting", "peek")),
      detent: "full" as const,
      userChose: true,
    };
    const next = nextDetentState(chosen, view("round-1:turn", "half"));
    expect(next.detent).toBe("full");
    expect(next.userChose).toBe(true);
  });

  it("applies the default again on the next round", () => {
    const chosen = {
      ...initialDetentState(view("round-1:turn", "half")),
      detent: "peek" as const,
      userChose: true,
    };
    const next = nextDetentState(chosen, view("round-2:turn", "half"));
    expect(next.detent).toBe("half");
    expect(next.userChose).toBe(false);
  });

  it("returns the same state when nothing changed", () => {
    const state = initialDetentState(view("round-1:turn", "half"));
    expect(nextDetentState(state, view("round-1:turn", "half"))).toBe(state);
  });
});
