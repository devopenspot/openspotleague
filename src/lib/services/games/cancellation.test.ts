import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  gameActionRequests,
  gamePlayers,
  gameRealtimeSignals,
  gameRounds,
  gameSessions,
} from "@/db/schema"
import type { Identity } from "@/lib/games/guest"

const { getDbClientMock } = vi.hoisted(() => ({
  getDbClientMock: vi.fn(),
}))

vi.mock("@/lib/db/client", () => ({
  getDbClient: () => getDbClientMock(),
  withDbRead: (_label: string, fn: () => unknown) => fn(),
  withDbWrite: (_label: string, fn: () => unknown) => fn(),
}))

import { cancelExpiredChallengeGames, cancelGame } from "@/lib/services/games"

const identity: Identity = {
  userId: "rider-1",
  guestToken: null,
  name: "Rider",
}

const mutation = {
  expectedVersion: 4,
  idempotencyKey: "cancel-key-1234567890123456789012",
}

function createDatabase(actorStatus: "active" | "left") {
  const updates: Array<{ table: unknown; values: Record<string, unknown> }> = []
  const deletes: unknown[] = []
  const game = {
    id: "game-1",
    mode: "training",
    status: "active",
    version: 4,
    currentRoundId: "round-1",
  }
  const rows = new Map<unknown, unknown[]>([
    [gameActionRequests, []],
    [gameSessions, [game]],
    [gamePlayers, [{ status: actorStatus }]],
    [gameRounds, [{ status: "collecting_results" }]],
  ])

  const tx = {
    select() {
      return {
        from(table: unknown) {
          const result = rows.get(table) ?? []
          const query = {
            where() {
              return query
            },
            orderBy() {
              return query
            },
            for() {
              return Promise.resolve(result)
            },
            limit() {
              return Promise.resolve(result)
            },
            then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
              return Promise.resolve(result).then(resolve, reject)
            },
          }
          return query
        },
      }
    },
    update(table: unknown) {
      return {
        set(values: Record<string, unknown>) {
          updates.push({ table, values })
          return {
            where: () => Promise.resolve(),
          }
        },
      }
    },
    insert(_table: unknown) {
      return {
        values: () => ({
          onConflictDoNothing: () => Promise.resolve(),
        }),
      }
    },
    delete(table: unknown) {
      deletes.push(table)
      return {
        where: () => Promise.resolve(),
      }
    },
  }

  return {
    updates,
    deletes,
    tx,
    db: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    },
  }
}

describe("cancelGame", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("lets a non-creator participant cancel while responses are being collected", async () => {
    const database = createDatabase("active")
    getDbClientMock.mockReturnValue(database)

    await expect(cancelGame(identity, "game-1", mutation)).resolves.toEqual({
      id: "game-1",
      version: 5,
    })

    expect(database.updates).toEqual(expect.arrayContaining([
      { table: gameRounds, values: { status: "cancelled" } },
      {
        table: gameSessions,
        values: expect.objectContaining({ status: "cancelled", version: 5 }),
      },
    ]))
  })

  it("rejects a rider who has already left the game", async () => {
    const database = createDatabase("left")
    getDbClientMock.mockReturnValue(database)

    await expect(cancelGame(identity, "game-1", mutation)).rejects.toMatchObject({
      code: "NOT_AUTHORIZED",
      message: "You are not a participant in this game",
    })
    expect(database.updates).toHaveLength(0)
  })
})

describe("cancelExpiredChallengeGames", () => {
  it("cancels expired challenge sessions, cancels open rounds, and purges realtime signals", async () => {
    const database = createDatabase("active")
    const now = new Date("2026-08-08T12:00:00.000Z")

    await cancelExpiredChallengeGames(database.tx as never, now)

    expect(database.updates).toEqual(expect.arrayContaining([
      {
        table: gameSessions,
        values: expect.objectContaining({
          status: "cancelled",
          version: 5,
          cancelledAt: now,
          updatedAt: now,
        }),
      },
      {
        table: gameRounds,
        values: expect.objectContaining({ status: "cancelled" }),
      },
    ]))
    expect(database.deletes).toContain(gameRealtimeSignals)
  })
})
