import { describe, expect, it } from "vitest"
import { gamePlayers, gameRounds, gameSessions } from "@/db/schema"
import { persistInitialGame } from "@/lib/services/games"
import type { Identity } from "@/lib/games/guest"
import type { GameState, Player } from "@/lib/games/definitions"

const identity: Identity = {
  userId: "user-1",
  guestToken: null,
  name: "Rider",
}

const game = {
  id: "game-1",
  mode: "training",
  ruleMode: "flexible",
  gameFormat: "tricks",
  trainingVariant: "multiplayer",
  disciplineSlug: "bmx",
  challengeKey: "bike",
  gameName: "Play a Bike",
  eliminationWord: "BIKE",
  wordLength: 4,
  initialSpotType: "bmx-dirt",
  nextSpotType: "bmx-dirt",
  nextLevel: 1,
} as GameState

const player = { id: "player-1" } as Player

function fakeTransaction() {
  const calls: Array<{ operation: string; table: unknown; values?: Record<string, unknown> }> = []
  const tx = {
    insert(table: unknown) {
      return {
        values(values: Record<string, unknown>) {
          calls.push({ operation: "insert", table, values })
          return Promise.resolve()
        },
      }
    },
    update(table: unknown) {
      calls.push({ operation: "update", table })
      return {
        set(values: Record<string, unknown>) {
          calls.push({ operation: "set", table, values })
          return {
            where() {
              return Promise.resolve()
            },
          }
        },
      }
    },
  }
  return { calls, tx }
}

describe("persistInitialGame", () => {
  it.each([false, true])("persists %s-challenge games in FK-safe order", async (challenge) => {
    const { calls, tx } = fakeTransaction()
    const persistedGame = { ...game, mode: challenge ? "challenge" : "training" } as GameState

    await persistInitialGame(tx as never, {
      game: persistedGame,
      player,
      initialRoundId: "round-1",
      snapshots: [{ slug: "bmx-dirt", name: "BMX Dirt", sortOrder: 1 }],
      challenge,
      catalogId: "catalog-1",
      spotId: challenge ? "spot-1" : null,
      scheduledStartAt: challenge ? new Date("2026-08-09T12:00:00.000Z") : null,
      timezone: challenge ? "UTC" : null,
      policy: challenge ? { maxAccuracy: 50, ttlSeconds: 900 } : null,
      identity,
      creatorIpHash: "ip-hash",
    })

    expect(calls.map((call) => call.operation)).toEqual(["insert", "insert", "insert", "update", "set"])
    expect(calls[0]?.table).toBe(gameSessions)
    expect(calls[0]?.values?.currentRoundId).toBeNull()
    expect(calls[0]?.values?.challengeRule).toBe("flexible")
    expect(calls[0]?.values?.gameFormat).toBe("tricks")
    expect(calls[0]?.values?.trainingVariant).toBe("multiplayer")
    expect(calls[0]?.values?.nextLevel).toBe(1)
    expect(calls[1]?.table).toBe(gamePlayers)
    expect(calls[2]?.table).toBe(gameRounds)
    expect(calls[2]?.values?.trickLevel).toBe(1)
    expect(calls[3]?.table).toBe(gameSessions)
    expect(calls[4]?.values).toEqual({ currentRoundId: "round-1" })
  })
})
