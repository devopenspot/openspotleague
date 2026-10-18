import { beforeEach, describe, expect, it, vi } from "vitest"
import { gameSessions, spots } from "@/db/schema"
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

const host: Identity = {
  userId: "host-1",
  guestToken: null,
  name: "Host",
}

// Finished challenge game whose spot was hard-deleted for moderation:
// detached with snapshots instead of destroyed (see `detachSpotDependents`).
const detachedGame = {
  id: "game-1",
  createdBy: "host-1",
  creatorDisplayName: "Host",
  status: "complete",
  version: 3,
  shareCode: "share-code",
  mode: "challenge",
  challengeRule: "strict",
  gameFormat: "tricks",
  trainingVariant: "multiplayer",
  lapCount: null,
  ghostMode: null,
  disciplineSlug: "skateboard",
  challengeKey: "skate",
  gameName: "HUBBA",
  eliminationWord: "SKATE",
  wordLength: 5,
  catalogId: "catalog-1",
  spotId: null,
  spotRemoved: true,
  spotNameSnapshot: "HUBBA HIDEOUT",
  spotCitySnapshot: "San Francisco",
  scheduledStartAt: null,
  timezone: null,
  locationRadiusMeters: null,
  nextSpotType: "plaza",
  nextLevel: null,
  selectedCategories: null,
  pendingCategories: null,
  pendingProposerPlayerId: null,
  pendingVotes: null,
  pendingProposalCreatedAt: null,
  availableSpotTypes: [],
  currentChallengerPlayerId: null,
  winnerPlayerId: null,
  rotationIndex: 0,
  currentRoundId: null,
  weatherForecastIcon: null,
  weatherObservedIcon: null,
  weatherConfirmed: null,
  weatherForecastDescription: null,
  weatherForecastTemp: null,
  weatherReportedAt: null,
}

function createDatabase() {
  const tablesQueried: unknown[] = []
  const chain = (result: unknown[]) => ({
    where: () => chain(result),
    orderBy: () => chain(result),
    limit: () => chain(result),
    offset: () => chain(result),
    groupBy: () => chain(result),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  })
  const tx = {
    select(..._args: unknown[]) {
      return {
        from(table: unknown) {
          tablesQueried.push(table)
          return chain(table === gameSessions ? [detachedGame] : [])
        },
      }
    },
  }
  return {
    tablesQueried,
    db: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe("detached spot games stay readable", () => {
  it("projects a finished game with a moderated-away spot and never touches the spots table", async () => {
    const database = createDatabase()
    getDbClientMock.mockReturnValue(database)

    const state = await getGameState(host, "game-1")

    expect(state).toMatchObject({
      id: "game-1",
      status: "complete",
      spotId: null,
      players: [],
      currentRound: null,
      stageLedger: [],
    })
    expect(database.tablesQueried).not.toContain(spots)
  })
})
