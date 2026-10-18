import { describe, expect, it } from "vitest"
import {
  deriveGameCapabilities,
  type CapabilityGameState,
  type GameViewer,
} from "@/lib/games/capabilities"

const NOW = new Date("2026-08-09T12:00:00.000Z")
const host: GameViewer = { playerId: "host", isHost: true, authenticated: true }
const rider: GameViewer = { playerId: "rider", isHost: false, authenticated: true }

function game(
  changes: Partial<CapabilityGameState> = {},
  roundChanges: Partial<NonNullable<CapabilityGameState["currentRound"]>> = {},
): CapabilityGameState {
  return {
    mode: "training",
    status: "lobby",
    scheduledStartAt: null,
    currentChallengerPlayerId: null,
    players: [
      { id: "host", status: "active" },
      { id: "rider", status: "active" },
    ],
    currentRound: {
      status: "selecting_spot_type",
      challengerPlayerId: null,
      eligiblePlayerIds: [],
      requiredResponsePlayerIds: [],
      attempts: [],
      verifications: [],
      ...roundChanges,
    },
    ...changes,
  }
}

describe("deriveGameCapabilities", () => {
  it("allows a new identity to join a non-full lobby in its permitted mode", () => {
    const invitee = { playerId: null, isHost: false, authenticated: false }
    const oneRiderLobby = game({ players: [{ id: "host", status: "active" }] })
    expect(deriveGameCapabilities(oneRiderLobby, invitee, NOW).canJoin).toBe(true)
    expect(deriveGameCapabilities(game({ mode: "challenge", players: [{ id: "host", status: "active" }] }), invitee, NOW).canJoin).toBe(false)
    expect(deriveGameCapabilities(game({ status: "active", players: [{ id: "host", status: "active" }] }), invitee, NOW).canJoin).toBe(false)
  })

  it("counts only active lobby riders toward the two-player capacity", () => {
    const players = [
      { id: "player-0", status: "active" as const },
      { id: "player-1", status: "left" as const },
    ]
    expect(deriveGameCapabilities(game({ players }), { ...rider, playerId: null }, NOW).canJoin).toBe(true)
    expect(deriveGameCapabilities(
      game({ players: players.map((player) => ({ ...player, status: "active" as const })) }),
      { ...rider, playerId: null },
      NOW,
    ).canJoin).toBe(false)
  })

  it("never lets a departed rider rejoin and lets only an active non-host leave", () => {
    const state = game({ players: [{ id: "host", status: "active" }, { id: "rider", status: "left" }] })
    expect(deriveGameCapabilities(state, rider, NOW).canJoin).toBe(false)
    expect(deriveGameCapabilities(state, rider, NOW).canLeave).toBe(false)
    expect(deriveGameCapabilities(game(), rider, NOW).canLeave).toBe(true)
    expect(deriveGameCapabilities(game(), host, NOW).canLeave).toBe(false)
  })

  it("starts training games for an active host with at least two active riders", () => {
    expect(deriveGameCapabilities(game(), host, NOW).canStart).toBe(true)
    expect(deriveGameCapabilities(
      game({ players: [{ id: "host", status: "active" }, { id: "rider", status: "left" }] }),
      host,
      NOW,
    ).canStart).toBe(false)
  })

  it("offers Train Alone only to the host of a one-rider trick lobby", () => {
    const soloLobby = game({
      gameFormat: "tricks",
      players: [{ id: "host", status: "active" }],
    })
    expect(deriveGameCapabilities(soloLobby, host, NOW).canTrainAlone).toBe(true)
    expect(deriveGameCapabilities(soloLobby, rider, NOW).canTrainAlone).toBe(false)
    expect(deriveGameCapabilities({ ...soloLobby, gameFormat: "bmx_track_racing" }, host, NOW).canTrainAlone).toBe(false)
    expect(deriveGameCapabilities({ ...soloLobby, trainingVariant: "solo" }, host, NOW).canTrainAlone).toBe(false)
  })

  it("starts challenge games only in the inclusive window with every active rider verified", () => {
    const challenge = game(
      { mode: "challenge", scheduledStartAt: new Date("2026-08-09T12:00:00.000Z") },
      {
        status: "verifying_location",
        verifications: [
          { playerId: "host", status: "verified" },
          { playerId: "rider", status: "verified" },
        ],
      },
    )
    expect(deriveGameCapabilities(challenge, host, new Date("2026-08-09T11:57:00.000Z")).canStart).toBe(false)
    expect(deriveGameCapabilities(challenge, host, new Date("2026-08-09T11:57:00.000Z")).canStartNow).toBe(true)
    expect(deriveGameCapabilities(challenge, host, NOW).canStart).toBe(true)
    expect(deriveGameCapabilities(challenge, host, new Date("2026-08-09T12:15:00.000Z")).canStart).toBe(true)
    expect(deriveGameCapabilities(challenge, host, new Date("2026-08-09T12:15:00.001Z")).canStart).toBe(false)
    expect(deriveGameCapabilities(
      {
        ...challenge,
        currentRound: {
          ...challenge.currentRound!,
          verifications: [{ playerId: "host", status: "verified" }],
        },
      },
      host,
      NOW,
    ).canStart).toBe(false)
  })

  it("ignores departed riders when checking challenge start readiness", () => {
    const challenge = game(
      {
        mode: "challenge",
        scheduledStartAt: NOW,
        players: [
          { id: "host", status: "active" },
          { id: "rider", status: "active" },
          { id: "left", status: "left" },
        ],
      },
      {
        status: "verifying_location",
        verifications: [
          { playerId: "host", status: "verified" },
          { playerId: "rider", status: "verified" },
        ],
      },
    )
    expect(deriveGameCapabilities(challenge, host, NOW).canStart).toBe(true)
  })

  it("allows every current participant to cancel non-terminal games", () => {
    expect(deriveGameCapabilities(game(), host, NOW).canCancel).toBe(true)
    expect(deriveGameCapabilities(game(), rider, NOW).canCancel).toBe(true)
    expect(deriveGameCapabilities(game({ status: "active" }), host, NOW).canCancel).toBe(true)
    expect(deriveGameCapabilities(
      game({ status: "active", players: [{ id: "host", status: "eliminated" }, { id: "rider", status: "active" }] }),
      host,
      NOW,
    ).canCancel).toBe(true)
    expect(deriveGameCapabilities(
      game({ status: "active" }, { status: "collecting_results" }),
      rider,
      NOW,
    ).canCancel).toBe(true)
    expect(deriveGameCapabilities(
      game({ status: "active", players: [{ id: "host", status: "active" }, { id: "rider", status: "left" }] }),
      rider,
      NOW,
    ).canCancel).toBe(false)
    expect(deriveGameCapabilities(game({ status: "complete" }), host, NOW).canCancel).toBe(false)
  })

  it("offers location verification only to active authenticated challenge participants", () => {
    const state = game({ mode: "challenge" }, { status: "paused" })
    expect(deriveGameCapabilities(state, rider, NOW).canVerifyLocation).toBe(true)
    expect(deriveGameCapabilities(state, { ...rider, authenticated: false }, NOW).canVerifyLocation).toBe(false)
    expect(deriveGameCapabilities(game({}, { status: "paused" }), rider, NOW).canVerifyLocation).toBe(false)
  })

  it("uses exact round statuses for current-leader settings", () => {
    const active = { status: "active" as const, currentChallengerPlayerId: "host" }
    const selectingType = game(active, { challengerPlayerId: "host", status: "selecting_spot_type" })
    expect(deriveGameCapabilities(selectingType, host, NOW)).toMatchObject({
      canSelectSpotType: true,
      canSelectLevel: false,
    })

    const selectingLevel = game(active, { challengerPlayerId: "host", status: "selecting_level" })
    expect(deriveGameCapabilities(selectingLevel, host, NOW)).toMatchObject({
      canSelectSpotType: false,
      canSelectLevel: true,
    })
    expect(deriveGameCapabilities(selectingType, rider, NOW)).toMatchObject({
      canSelectSpotType: false,
      canSelectLevel: false,
    })

    const live = game(active, { challengerPlayerId: "host", status: "challenge_open" })
    expect(deriveGameCapabilities(live, host, NOW)).toMatchObject({
      canSelectSpotType: false,
      canSelectLevel: false,
      canSubmitChallenge: true,
      canAdvanceToNextTrick: false,
    })
    const flexible = game(
      { ...active, ruleMode: "flexible" },
      { challengerPlayerId: "host", status: "challenge_open" },
    )
    expect(deriveGameCapabilities(flexible, host, NOW).canAdvanceToNextTrick).toBe(true)
    expect(deriveGameCapabilities(
      { ...flexible, ruleMode: "strict" },
      host,
      NOW,
    ).canAdvanceToNextTrick).toBe(false)
    expect(deriveGameCapabilities(
      { ...flexible, ruleMode: "flexible" },
      rider,
      NOW,
    ).canAdvanceToNextTrick).toBe(false)
    expect(deriveGameCapabilities(
      { ...flexible, ruleMode: "flexible", players: [{ id: "host", status: "eliminated" }, { id: "rider", status: "active" }] },
      host,
      NOW,
    ).canAdvanceToNextTrick).toBe(false)
    expect(deriveGameCapabilities(
      { ...flexible, ruleMode: "flexible" },
      host,
      NOW,
    ).canAdvanceToNextTrick).toBe(true)
  })

  it("allows flexible leaders to advance during response collection only", () => {
    const collecting = game(
      { status: "active", ruleMode: "flexible", currentChallengerPlayerId: "host" },
      { challengerPlayerId: "host", status: "collecting_results" },
    )
    expect(deriveGameCapabilities(collecting, host, NOW).canAdvanceToNextTrick).toBe(true)

    expect(deriveGameCapabilities(
      { ...collecting, status: "complete" },
      host,
      NOW,
    ).canAdvanceToNextTrick).toBe(false)
  })

  it("requires challenge leaders and responders to belong to the eligibility snapshot", () => {
    const state = game(
      { mode: "challenge", status: "active", currentChallengerPlayerId: "host" },
      { challengerPlayerId: "host", status: "challenge_open", eligiblePlayerIds: ["rider"] },
    )
    expect(deriveGameCapabilities(state, host, NOW).canSubmitChallenge).toBe(false)

    const responses = game(
      { mode: "challenge", status: "active", currentChallengerPlayerId: "host" },
      {
        challengerPlayerId: "host",
        status: "collecting_results",
        eligiblePlayerIds: ["host", "rider"],
        requiredResponsePlayerIds: ["rider"],
      },
    )
    expect(deriveGameCapabilities(responses, rider, NOW).canSubmitResponse).toBe(true)
    expect(deriveGameCapabilities(
      {
        ...responses,
        currentRound: {
          ...responses.currentRound!,
          attempts: [{ playerId: "rider", result: "landed" }],
        },
      },
      rider,
      NOW,
    ).canSubmitResponse).toBe(false)
  })

  it("disables every mutation capability for terminal games", () => {
    const state = game(
      { status: "cancelled", currentChallengerPlayerId: "host" },
      {
        challengerPlayerId: "host",
        status: "challenge_open",
        requiredResponsePlayerIds: ["host"],
      },
    )
    expect(Object.values(deriveGameCapabilities(state, host, NOW)).every((value) => !value)).toBe(true)
  })
})
