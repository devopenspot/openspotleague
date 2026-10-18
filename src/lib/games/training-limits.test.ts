import { describe, expect, it } from "vitest"
import {
  CHALLENGE_GAME_INACTIVITY_MS,
  CHALLENGE_LOBBY_GRACE_MS,
  TRAINING_GAME_INACTIVITY_MS,
  TRAINING_GAME_LIMIT,
  challengeActiveExpiry,
  challengeLobbyExpiry,
  isChallengeGameExpired,
  isTrainingGameExpired,
  trainingGameExpiry,
} from "@/lib/games/training-limits"

describe("training game limits", () => {
  it("allows three open games per creator IP", () => {
    expect(TRAINING_GAME_LIMIT).toBe(3)
  })

  it("expires games after ten minutes without an update", () => {
    const now = new Date("2026-08-08T12:00:00.000Z")
    expect(trainingGameExpiry(now).toISOString()).toBe("2026-08-08T11:50:00.000Z")
    expect(isTrainingGameExpired(new Date(now.getTime() - TRAINING_GAME_INACTIVITY_MS - 1), now)).toBe(true)
    expect(isTrainingGameExpired(new Date(now.getTime() - TRAINING_GAME_INACTIVITY_MS), now)).toBe(false)
  })
})

describe("challenge game expiry", () => {
  it("preserves scheduled challenge lobbies within the 15-minute start grace window", () => {
    const now = new Date("2026-08-08T12:00:00.000Z")
    expect(challengeLobbyExpiry(now).toISOString()).toBe("2026-08-08T11:45:00.000Z")

    const withinGraceLobby = {
      status: "lobby" as const,
      scheduledStartAt: new Date(now.getTime() - CHALLENGE_LOBBY_GRACE_MS),
      updatedAt: new Date("2026-08-08T11:00:00.000Z"),
    }
    expect(isChallengeGameExpired(withinGraceLobby, now)).toBe(false)

    const expiredScheduledLobby = {
      status: "lobby" as const,
      scheduledStartAt: new Date(now.getTime() - CHALLENGE_LOBBY_GRACE_MS - 1),
      updatedAt: new Date("2026-08-08T11:55:00.000Z"),
    }
    expect(isChallengeGameExpired(expiredScheduledLobby, now)).toBe(true)
  })

  it("expires active challenge games after 60 minutes of inactivity", () => {
    const now = new Date("2026-08-08T12:00:00.000Z")
    expect(challengeActiveExpiry(now).toISOString()).toBe("2026-08-08T11:00:00.000Z")

    expect(
      isChallengeGameExpired(
        {
          status: "active",
          scheduledStartAt: null,
          updatedAt: new Date(now.getTime() - CHALLENGE_GAME_INACTIVITY_MS),
        },
        now,
      ),
    ).toBe(false)

    expect(
      isChallengeGameExpired(
        {
          status: "active",
          scheduledStartAt: null,
          updatedAt: new Date(now.getTime() - CHALLENGE_GAME_INACTIVITY_MS - 1),
        },
        now,
      ),
    ).toBe(true)
  })
})
