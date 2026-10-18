import { describe, expect, it } from "vitest";
import type { GameCapabilities } from "@/lib/games/capabilities";
import type { GameState } from "@/lib/schemas/game";
import { deriveHeaderState, EMPTY_CAPABILITIES } from "./header-state";

const capabilities: GameCapabilities = {
  ...EMPTY_CAPABILITIES,
  canJoin: true,
  canCancel: true,
};

const activeChallengeGame = {
  id: "game-1",
  mode: "challenge",
  ruleMode: "strict",
  status: "active",
  shareCode: "RIDE-123",
  gameName: "Play a Bike",
  viewerIsHost: false,
  currentChallengerPlayerId: "leader",
  viewerPlayerId: "rider",
  nextLevel: 3,
  players: [
    { id: "leader", displayName: "Leader", status: "active" },
    { id: "rider", displayName: "Rider", status: "active" },
  ],
  winnerPlayerId: null,
  currentRound: {
    id: "round-1",
    sequence: 2,
    status: "collecting_results",
    challengerPlayerId: "leader",
    trickLevel: 2,
    verifications: [{ playerId: "rider", status: "verified" }],
  },
} as unknown as GameState;

describe("deriveHeaderState", () => {
  it("returns an inert snapshot when no game is loaded", () => {
    const state = deriveHeaderState(null, capabilities);
    expect(state.isTerminal).toBe(false);
    expect(state.current).toBeUndefined();
    expect(state.canJoinLobby).toBe(false);
    expect(state.canCancel).toBe(false);
    expect(state.roundNotice).toBeNull();
    expect(state.levelLabel).toBeNull();
  });

  it("derives the level label and live-challenge flag from the round", () => {
    const state = deriveHeaderState(activeChallengeGame, capabilities);
    expect(state.effectiveLevel).toBe(2);
    expect(state.levelLabel).toBe("Intermediate");
    expect(state.isLiveChallenge).toBe(true);
    expect(state.leader?.displayName).toBe("Leader");
  });

  it("computes cancel windows per game status", () => {
    const active = deriveHeaderState(activeChallengeGame, capabilities);
    expect(active.canCancelActive).toBe(true);
    expect(active.canCancelLobby).toBe(false);
    expect(active.canCancel).toBe(true);

    const lobby = deriveHeaderState(
      { ...activeChallengeGame, status: "lobby" } as unknown as GameState,
      capabilities,
    );
    expect(lobby.canCancelLobby).toBe(true);
    expect(lobby.canCancelActive).toBe(false);
  });

  it("reads lobby readiness from rider check-ins", () => {
    const lobbyGame = {
      ...activeChallengeGame,
      status: "lobby",
      currentRound: {
        status: "verifying_location",
        verifications: [
          { playerId: "leader", status: "verified" },
          { playerId: "rider", status: "verified" },
        ],
      },
    } as unknown as GameState;
    expect(deriveHeaderState(lobbyGame, capabilities).lobbyReady).toBe(true);
  });

  it("falls back to the next level's label when the round has none", () => {
    const betweenRounds = {
      ...activeChallengeGame,
      currentRound: null,
      nextLevel: 5,
    } as unknown as GameState;
    const state = deriveHeaderState(betweenRounds, capabilities);
    expect(state.effectiveLevel).toBe(5);
    expect(state.levelLabel).toBe("Master");
    expect(state.isLiveChallenge).toBe(false);
  });

  it("surfaces the blocked-round notice with its fallback copy", () => {
    const blocked = {
      ...activeChallengeGame,
      currentRound: { ...activeChallengeGame.currentRound, status: "no_compatible_trick" },
    } as unknown as GameState;
    const state = deriveHeaderState(blocked, capabilities);
    expect(state.roundNotice).toBe(
      "No Trick Fits This Spot and Level — Leader, Switch It Up To Keep Riding!",
    );

    const blockedWithReason = {
      ...blocked,
      currentRound: { ...(blocked.currentRound as object), blockedReason: "Spot too mellow" },
    } as unknown as GameState;
    expect(deriveHeaderState(blockedWithReason, capabilities).roundNotice).toBe(
      "Spot too mellow",
    );
  });

  it("builds the terminal banner for a won, lost, and cancelled session", () => {
    const won = deriveHeaderState(
      {
        ...activeChallengeGame,
        status: "complete",
        winnerPlayerId: "rider",
      } as unknown as GameState,
      capabilities,
    );
    expect(won.isTerminal).toBe(true);
    expect(won.terminalTone).toBe("success");
    expect(won.terminalTitle).toBe("You Won!");
    expect(won.terminalDescription).toBe(
      "Rider Took The Win — Check The Final Scores Below.",
    );

    const lost = deriveHeaderState(
      {
        ...activeChallengeGame,
        status: "complete",
        winnerPlayerId: "leader",
      } as unknown as GameState,
      capabilities,
    );
    expect(lost.terminalTone).toBe("info");
    expect(lost.terminalTitle).toBe("Session Complete");

    const cancelled = deriveHeaderState(
      { ...activeChallengeGame, status: "cancelled" } as unknown as GameState,
      capabilities,
    );
    expect(cancelled.terminalTone).toBe("danger");
    expect(cancelled.terminalLabel).toBe("Session Status");
    expect(cancelled.terminalDescription).toBe("This Session Was Closed.");
  });

  it("shows categories as All when none are selected", () => {
    const state = deriveHeaderState(activeChallengeGame, capabilities);
    expect(state.isCategoriesAll).toBe(true);
    expect(state.categoriesDisplay).toBe("All");

    const withCats = {
      ...activeChallengeGame,
      selectedCategories: ["rails", "bowl"],
    } as unknown as GameState;
    const catsState = deriveHeaderState(withCats, capabilities);
    expect(catsState.isCategoriesAll).toBe(false);
    expect(catsState.categoriesDisplay).toBe("rails, bowl");
  });
});
