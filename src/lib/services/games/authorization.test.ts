import { beforeEach, describe, expect, it, vi } from "vitest"
import { gameSessions } from "@/db/schema"
import { getGameState } from "@/lib/services/games"
import type { Identity } from "@/lib/games/guest"

const { getDbClientMock } = vi.hoisted(() => ({
  getDbClientMock: vi.fn(),
}))

vi.mock("@/lib/db/client", () => ({
  getDbClient: () => getDbClientMock(),
  withDbRead: (_label: string, fn: () => unknown) => fn(),
  withDbWrite: (_label: string, fn: () => unknown) => fn(),
}))

const user: Identity = {
  userId: "invitee-1",
  guestToken: null,
  name: "Rider",
}

const guest: Identity = {
  userId: null,
  guestToken: "guest-token-123456789012345678901234",
  name: "Guest Rider",
}

function createDatabase(overrides: Partial<{
  mode: string
  status: string
  version: number
  isMember: boolean
}> = {}) {
  const game = {
    id: "game-1",
    mode: "challenge",
    status: "lobby",
    version: 4,
    shareCode: "share-code",
    createdBy: "host-1",
    isMember: false,
    ...overrides,
  }

  function query(result: unknown[]) {
    const builder = {
      where() {
        return builder
      },
      then(
        resolve: (value: unknown[]) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(result).then(resolve, reject)
      },
    }
    return builder
  }

  const select = (..._args: unknown[]) => ({
    from(table: unknown) {
      return query(table === gameSessions ? [game] : [])
    },
  })

  const tx = { select }
  const transaction = vi.fn(
    async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
  )

  return {
    transaction,
    db: {
      select,
      transaction,
    },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("challenge share-code authorization", () => {
  it("allows a signed-in non-member to read a challenge lobby without opening a transaction on 304", async () => {
    const database = createDatabase()
    getDbClientMock.mockReturnValue(database)

    await expect(getGameState(user, "game-1", "share-code", 4)).resolves.toBeNull()
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it("allows a participant to short-circuit 304 on an active challenge without a share code", async () => {
    const database = createDatabase({ status: "active", isMember: true })
    getDbClientMock.mockReturnValue(database)

    await expect(getGameState(user, "game-1", undefined, 4)).resolves.toBeNull()
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it.each([undefined, "wrong-code"])(
    "rejects a challenge lobby when the share code is %s",
    async (shareCode) => {
      const database = createDatabase()
      getDbClientMock.mockReturnValue(database)

      await expect(getGameState(user, "game-1", shareCode, 4)).rejects.toMatchObject({
        code: "NOT_AUTHORIZED",
      })
      expect(database.transaction).not.toHaveBeenCalled()
    },
  )

  it("does not let a share code expose an active challenge to a non-member", async () => {
    const database = createDatabase({ status: "active" })
    getDbClientMock.mockReturnValue(database)

    await expect(getGameState(user, "game-1", "share-code", 4)).rejects.toMatchObject({
      code: "NOT_AUTHORIZED",
    })
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it("keeps guests from reading challenge state", async () => {
    const database = createDatabase()
    getDbClientMock.mockReturnValue(database)

    await expect(getGameState(guest, "game-1", "share-code", 4)).rejects.toMatchObject({
      code: "NOT_AUTHORIZED",
    })
    expect(database.transaction).not.toHaveBeenCalled()
  })

  it("preserves share-code access for training guests", async () => {
    const database = createDatabase({ mode: "training", status: "active" })
    getDbClientMock.mockReturnValue(database)

    await expect(getGameState(guest, "game-1", "share-code", 4)).resolves.toBeNull()
    expect(database.transaction).not.toHaveBeenCalled()
  })
})
