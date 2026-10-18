import { describe, expect, it } from "vitest"
import { createLobby, prepareNextRound, selectAlternativeTrickForSpotType as selectAlternativeTrickForSpotTypeEngine, selectChallengeSettings, selectLevel as selectLevelEngine, selectSpotType as selectSpotTypeEngine, selectTrickForSpotType as selectTrickForSpotTypeEngine, startGame as startGameEngine, startSoloTraining, submitChallengerResult, submitResponse } from "@/lib/games/engine"
import { GAME_DEFINITIONS, GameDomainError, type Player } from "@/lib/games/definitions"
import { catalogForDiscipline } from "@/lib/games/catalogs"
import type { DisciplineSlug, SpotTypeSnapshot, TrickLevel } from "@/lib/schemas/game"

const spotTypes: SpotTypeSnapshot[] = [
  { slug: "rails", name: "Rails", sortOrder: 7 },
  { slug: "ledges", name: "Ledges", sortOrder: 5 },
  { slug: "stair", name: "Stair", sortOrder: 2 },
]

const players: Player[] = [
  { id: "p1", userId: "u1", guestToken: null, displayName: "One", letters: "", failedAttempts: 0, status: "active" },
  { id: "p2", userId: "u2", guestToken: null, displayName: "Two", letters: "", failedAttempts: 0, status: "active" },
]
const firstPlayer = players[0] as Player
const thirdPlayer: Player = { id: "p3", userId: "u3", guestToken: null, displayName: "Three", letters: "", failedAttempts: 0, status: "active" }

const guestPlayers: Player[] = [
  { id: "p1", userId: null, guestToken: "tok-aaa", displayName: "Guest One", letters: "", failedAttempts: 0, status: "active" },
  { id: "p2", userId: null, guestToken: "tok-bbb", displayName: "Guest Two", letters: "", failedAttempts: 0, status: "active" },
]

const actor = (userId: string) => ({ userId, guestToken: null })
const guestActor = (guestToken: string) => ({ userId: null, guestToken })

function makeLobby(input: Omit<Parameters<typeof createLobby>[0], "definition" | "catalog">) {
  return createLobby({
    ...input,
    definition: GAME_DEFINITIONS[input.disciplineSlug],
    catalog: catalogForDiscipline(input.disciplineSlug),
  })
}

function selectSpotType(state: Parameters<typeof selectSpotTypeEngine>[0], actor: Parameters<typeof selectSpotTypeEngine>[1], spotType: string) {
  return selectSpotTypeEngine(state, actor, spotType, catalogForDiscipline(state.disciplineSlug))
}

function selectLevel(state: Parameters<typeof selectLevelEngine>[0], actor: Parameters<typeof selectLevelEngine>[1], level: TrickLevel, usedTrickIds: readonly string[]) {
  return selectLevelEngine(state, actor, level, usedTrickIds, catalogForDiscipline(state.disciplineSlug))
}

function selectTrickForSpotType(discipline: DisciplineSlug, spotType: string, level: TrickLevel, usedTrickIds: readonly string[]) {
  return selectTrickForSpotTypeEngine(catalogForDiscipline(discipline), spotType, level, usedTrickIds)
}

function selectAlternativeTrickForSpotType(discipline: DisciplineSlug, spotType: string, level: TrickLevel, excludedTrickIds: readonly string[]) {
  return selectAlternativeTrickForSpotTypeEngine(catalogForDiscipline(discipline), spotType, level, excludedTrickIds)
}

function startGame(state: Parameters<typeof startGameEngine>[0], input: Parameters<typeof startGameEngine>[1]) {
  return startGameEngine(state, input, { chooseRotation: (playerIds) => playerIds })
}

function lobby() {
  return makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "roller", createdBy: "u1", creatorDisplayName: "One", players, availableSpotTypes: spotTypes, initialSpotType: "rails" })
}

function trainingLobby(participants: Player[] = guestPlayers) {
  return makeLobby({ id: "g1", mode: "training", disciplineSlug: "roller", createdBy: "tok-aaa", creatorDisplayName: "Guest One", players: participants, availableSpotTypes: spotTypes, initialSpotType: "rails" })
}

function activeGame() {
  const created = lobby()
  return startGame(created, {
    actorUserId: "u1",
    verifiedPlayerIds: ["p1", "p2"],
    scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
    now: new Date("2026-01-01T12:00:00Z"),
  })
}

function challengeGame() {
  return selectLevel(selectSpotType(activeGame(), actor("u1"), "rails"), actor("u1"), 1, [])
}

function soloTrainingLobby() {
  return makeLobby({
    id: "solo-game",
    mode: "training",
    gameFormat: "tricks",
    disciplineSlug: "roller",
    createdBy: "tok-aaa",
    creatorDisplayName: "Guest One",
    players: [guestPlayers[0] as Player],
    availableSpotTypes: spotTypes,
    initialSpotType: "rails",
    initialLevel: 1,
  })
}

function soloTrainingGame() {
  return startSoloTraining(
    soloTrainingLobby(),
    { actorUserId: "tok-aaa" },
    {
      idFactory: () => "solo-round-1",
      usedTrickIds: [],
      catalog: catalogForDiscipline("roller"),
    },
  )
}

describe("challenge game engine", () => {
  it("rejects invalid player counts and spot types", () => {
    expect(makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "roller", createdBy: "u1", creatorDisplayName: "One", players: [firstPlayer], availableSpotTypes: spotTypes, initialSpotType: "rails" }).status).toBe("lobby")
    expect(() => makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "roller", createdBy: "u1", creatorDisplayName: "One", players: [...players, thirdPlayer], availableSpotTypes: spotTypes, initialSpotType: "rails" })).toThrow(/between one and two players/i)
    expect(() => makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "roller", createdBy: "u1", creatorDisplayName: "One", players, availableSpotTypes: spotTypes, initialSpotType: "bowl" })).toThrow(GameDomainError)
  })

  it("rejects a lobby with no compatible catalog pair", () => {
    expect(() => makeLobby({
      id: "g1",
      mode: "challenge",
      disciplineSlug: "roller",
      createdBy: "u1",
      creatorDisplayName: "One",
      players,
      availableSpotTypes: [{ slug: "bmx-track", name: "BMX Track", sortOrder: 1 }],
      initialSpotType: "bmx-track",
    })).toThrow(/no compatible trick/i)
  })

  it("starts only inside the inclusive scheduled window", () => {
    const created = lobby()
    const args = { actorUserId: "u1", verifiedPlayerIds: ["p1", "p2"], scheduledStartAt: new Date("2026-01-01T12:00:00Z"), now: new Date("2026-01-01T12:15:00Z") }
    expect(startGame(created, args).status).toBe("active")
    expect(() => startGame(created, { ...args, now: new Date("2026-01-01T12:15:00.001Z") })).toThrow(GameDomainError)
    expect(() => startGame(created, { ...args, verifiedPlayerIds: ["p1"] })).toThrow(GameDomainError)
  })

  it("allows an explicitly requested host early start before the schedule", () => {
    const created = lobby()
    const scheduledStartAt = new Date("2026-01-01T12:05:00Z")

    expect(startGame(created, {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt,
      now: new Date("2026-01-01T12:02:00Z"),
      allowEarlyStart: true,
    }).status).toBe("active")
    expect(() => startGame(created, {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt,
      now: new Date("2026-01-01T12:02:00Z"),
    })).toThrow(GameDomainError)
  })

  it("persists a valid rotation permutation selected at start", () => {
    const started = startGameEngine(lobby(), {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
      now: new Date("2026-01-01T12:00:00Z"),
    }, { chooseRotation: () => ["p2", "p1"] })
    expect(started.rotationOrder).toEqual(["p2", "p1"])
    expect(started.currentChallengerPlayerId).toBe("p2")
    expect(() => startGameEngine(lobby(), {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
      now: new Date("2026-01-01T12:00:00Z"),
    }, { chooseRotation: () => ["p1", "p1"] })).toThrow(GameDomainError)
  })

  it("opens a new game with its stored initial spot type and level", () => {
    const created = makeLobby({
      id: "g1",
      mode: "training",
      ruleMode: "flexible",
      disciplineSlug: "roller",
      createdBy: "u1",
      creatorDisplayName: "One",
      players,
      availableSpotTypes: spotTypes,
      initialSpotType: "rails",
      initialLevel: 1,
    })
    const started = startGameEngine(created, {
      actorUserId: "u1",
      verifiedPlayerIds: [],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    }, { chooseRotation: (playerIds) => playerIds, catalog: catalogForDiscipline("roller"), usedTrickIds: [] })

    expect(started.currentRound?.status).toBe("challenge_open")
    expect(started.currentRound?.spotType).toBe("rails")
    expect(started.currentRound?.level).toBe(1)
    expect(started.currentRound?.trick).not.toBeNull()
  })

  it("increments the persisted aggregate version when starting", () => {
    const created = { ...trainingLobby(), version: 7 }
    const started = startGame(created, {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: [],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    expect(started.version).toBe(8)
  })

  it("requires the training creator to start the game", () => {
    expect(() => startGameEngine(trainingLobby(), {
      actorUserId: "tok-bbb",
      verifiedPlayerIds: [],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    }, { chooseRotation: (playerIds) => playerIds })).toThrow(GameDomainError)
  })

  it("includes every active player in a training eligibility snapshot", () => {
    const started = startGame(trainingLobby(), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    expect(started.currentRound?.eligiblePlayerIds).toEqual(["p1", "p2"])
  })

  it("starts a one-rider solo training rotation with the stored trick", () => {
    const started = soloTrainingGame()

    expect(started.trainingVariant).toBe("solo")
    expect(started.status).toBe("active")
    expect(started.rotationOrder).toEqual(["p1"])
    expect(started.currentChallengerPlayerId).toBe("p1")
    expect(started.currentRound?.status).toBe("challenge_open")
    expect(started.currentRound?.eligiblePlayerIds).toEqual(["p1"])
    expect(started.currentRound?.trick).not.toBeNull()
  })

  it("requires exactly one active rider and the creator for solo training", () => {
    expect(() => startSoloTraining(
      trainingLobby([guestPlayers[0] as Player, guestPlayers[1] as Player]),
      { actorUserId: "tok-aaa" },
    )).toThrow(/exactly one active rider/i)
    expect(() => startSoloTraining(
      soloTrainingLobby(),
      { actorUserId: "tok-bbb" },
    )).toThrow(GameDomainError)
  })

  it.each(["landed", "failed"] as const)("resolves a solo %s immediately and prepares the next trick", (result) => {
    const next = submitChallengerResult(
      soloTrainingGame(),
      guestActor("tok-aaa"),
      result,
      {
        idFactory: () => "solo-round-2",
        usedTrickIds: [],
        catalog: catalogForDiscipline("roller"),
      },
    )

    expect(next.status).toBe("active")
    expect(next.trainingVariant).toBe("solo")
    expect(next.players[0]).toMatchObject({ letters: "", failedAttempts: 0, status: "active" })
    expect(next.currentChallengerPlayerId).toBe("p1")
    expect(next.currentRound?.id).toBe("solo-round-2")
    expect(next.currentRound?.status).toBe("challenge_open")
    expect(next.currentRound?.requiredResponsePlayerIds).toEqual([])
    expect(next.roundHistory[0]).toMatchObject({
      challengerResult: result,
      status: "resolved",
      challengeOutcome: result === "landed" ? "resolved" : "failed_to_establish",
    })
    expect(() => submitResponse(next, guestActor("tok-aaa"), "landed")).toThrow(GameDomainError)
  })

  it("keeps leader-only selection and persists the level before opening the challenge", () => {
    const game = activeGame()
    const selectedType = selectSpotType(game, actor("u1"), "ledges")
    expect(selectedType.nextSpotType).toBe("ledges")
    expect(() => selectLevel(selectedType, actor("u2"), 1, [])).toThrow(GameDomainError)
    const selectedLevel = selectLevel(selectedType, actor("u1"), 1, [])
    expect(selectedLevel.currentRound?.status).toBe("challenge_open")
    expect(selectedLevel.currentRound?.trick?.compatibleSpotTypes).toContain("ledges")
    expect(selectedLevel.currentRound?.trick?.discipline).toBe("roller")
  })

  it("selects spot type and level in one setup transition", () => {
    const game = activeGame()
    const next = selectChallengeSettings(game, actor("u1"), "ledges", 1, [], catalogForDiscipline("roller"))

    expect(next.version).toBe(game.version + 1)
    expect(next.nextSpotType).toBe("ledges")
    expect(next.nextLevel).toBe(1)
    expect(next.currentRound?.status).toBe("challenge_open")
    expect(next.currentRound?.spotType).toBe("ledges")
    expect(next.currentRound?.level).toBe(1)
    expect(next.currentRound?.trick?.compatibleSpotTypes).toContain("ledges")
  })

  it("returns a blocked setup state when the selected pair has no trick", () => {
    // stair + level 5 is empty in the skateboard fixture; keep it that way
    // or pick another empty pair (see the per-level coverage in the fixture).
    const created = makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "skateboard", createdBy: "u1", creatorDisplayName: "One", players, availableSpotTypes: spotTypes, initialSpotType: "rails" })
    const game = startGame(created, {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const next = selectChallengeSettings(game, actor("u1"), "stair", 5, [], catalogForDiscipline("skateboard"))

    expect(next.currentRound?.status).toBe("no_compatible_trick")
    expect(next.currentRound?.blockedReason).toContain("level 5")
    expect(next.currentRound?.trick).toBeNull()
  })

  it("stores active-round settings for the next round without rewriting the trick", () => {
    // Strict keeps trick for next round; flexible is immediate (see next test)
    const generated = { ...challengeGame(), ruleMode: "strict" as const }
    const changedType = selectSpotType(generated, actor("u1"), "ledges")
    const changedLevel = selectLevel(changedType, actor("u1"), 2, [])
    expect(changedLevel.nextSpotType).toBe("ledges")
    expect(changedLevel.nextLevel).toBe(2)
    expect(changedLevel.currentRound?.status).toBe("challenge_open")
    expect(changedLevel.currentRound?.trick?.id).toBe(generated.currentRound?.trick?.id)
  })

  it("updates flexible live trick immediately", () => {
    const generated = challengeGame() // flexible by default
    const changedType = selectSpotType(generated, actor("u1"), "ledges")
    expect(changedType.currentRound?.trick?.compatibleSpotTypes).toContain("ledges")
    expect(changedType.nextSpotType).toBe("ledges")
    const changedLevel = selectLevel(changedType, actor("u1"), 2, [])
    expect(changedLevel.nextLevel).toBe(2)
    expect(changedLevel.currentRound?.level).toBe(2)
    expect(changedLevel.currentRound?.trick?.compatibleSpotTypes).toContain("ledges")
    expect(changedLevel.currentRound?.trick?.level).toBe(2)
  })

  it("updates both next-round settings in one flexible live transition", () => {
    const generated = { ...challengeGame(), ruleMode: "flexible" as const }
    const next = selectChallengeSettings(generated, actor("u1"), "ledges", 2, [], catalogForDiscipline("roller"))

    expect(next.version).toBe(generated.version + 1)
    expect(next.nextSpotType).toBe("ledges")
    expect(next.nextLevel).toBe(2)
    expect(next.currentRound?.spotType).toBe("ledges")
    expect(next.currentRound?.level).toBe(2)
    expect(next.currentRound?.trick?.compatibleSpotTypes).toContain("ledges")
    expect(next.currentRound?.trick?.level).toBe(2)
  })

  it("rejects combined live settings in strict mode", () => {
    expect(() => selectChallengeSettings({ ...challengeGame(), ruleMode: "strict" }, actor("u1"), "ledges", 2, [], catalogForDiscipline("roller"))).toThrow(/strict/i)
  })

  it("rotates after challenger failure without assigning letters or points", () => {
    const next = submitChallengerResult(challengeGame(), actor("u1"), "failed")
    expect(next.currentChallengerPlayerId).toBe("p2")
    expect(next.players.every((player) => player.failedAttempts === 0)).toBe(true)
    expect(next.currentRound?.status).toBe("verifying_location")
    expect(next.roundHistory[0]?.challengeOutcome).toBe("failed_to_establish")
  })

  it("opens the next challenge round with no eligibility until re-verification", () => {
    const next = submitChallengerResult(challengeGame(), actor("u1"), "failed")
    expect(next.currentRound?.eligiblePlayerIds).toEqual([])
  })

  it("snapshots every active player for the next training round", () => {
    const started = startGame(trainingLobby(), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const game = selectLevel(selectSpotType(started, guestActor("tok-aaa"), "rails"), guestActor("tok-aaa"), 1, [])
    const next = submitChallengerResult(game, guestActor("tok-aaa"), "failed")
    expect(next.currentRound?.eligiblePlayerIds).toEqual(["p1", "p2"])
  })

  it("retains the successful challenger and records response failures", () => {
    const responsePhase = submitChallengerResult(challengeGame(), actor("u1"), "landed")
    const resolved = submitResponse(responsePhase, actor("u2"), "failed")
    expect(resolved.currentRound?.status).toBe("resolved")
    expect(resolved.currentChallengerPlayerId).toBe("p1")
    expect(resolved.players.find((player) => player.id === "p2")?.failedAttempts).toBe(1)
    expect(resolved.players.find((player) => player.id === "p2")?.letters).toBe("B")
    const prepared = prepareNextRound(resolved, {
      usedTrickIds: [],
      catalog: catalogForDiscipline("roller"),
    })
    expect(prepared.currentRound?.challengerPlayerId).toBe("p1")
    expect(prepared.currentRound?.level).toBe(1)
    expect(prepared.currentRound?.trick).not.toBeNull()
  })

  it("eliminates a rider when the fifth letter is assigned", () => {
    const responsePhase = submitChallengerResult(challengeGame(), actor("u1"), "landed")
    const prepared = {
      ...responsePhase,
      players: responsePhase.players.map((player) => player.id === "p2" ? { ...player, letters: "BLAD", failedAttempts: 4 } : player),
    }
    const complete = submitResponse(prepared, actor("u2"), "failed")
    expect(complete.status).toBe("complete")
    expect(complete.players.find((player) => player.id === "p2")?.letters).toBe("BLADE")
    expect(complete.players.find((player) => player.id === "p2")?.status).toBe("eliminated")
  })

  it("blocks a level with no compatible tricks in the catalog", () => {
    const created = makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "skateboard", createdBy: "u1", creatorDisplayName: "One", players, availableSpotTypes: spotTypes, initialSpotType: "rails" })
    const game = startGame(created, {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const selectedType = selectSpotType(game, actor("u1"), "stair")
    const blocked = selectLevel(selectedType, actor("u1"), 5, [])
    expect(blocked.currentRound?.status).toBe("no_compatible_trick")
    expect(blocked.currentRound?.blockedReason).toContain("level 5")
  })

  it("recovers from no_compatible_trick by changing the level", () => {
    const created = makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "skateboard", createdBy: "u1", creatorDisplayName: "One", players, availableSpotTypes: spotTypes, initialSpotType: "rails" })
    const game = startGame(created, {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const atStair = selectSpotType(game, actor("u1"), "stair")
    const blocked = selectLevel(atStair, actor("u1"), 2, [])
    const recovered = selectLevel(blocked, actor("u1"), 1, [])
    expect(recovered.currentRound?.status).toBe("challenge_open")
    expect(recovered.currentRound?.trick?.compatibleSpotTypes).toContain("stair")
    expect(recovered.nextLevel).toBe(1)
  })

  it("recovers from no_compatible_trick by changing the spot type", () => {
    const created = makeLobby({ id: "g1", mode: "challenge", disciplineSlug: "skateboard", createdBy: "u1", creatorDisplayName: "One", players, availableSpotTypes: spotTypes, initialSpotType: "rails" })
    const game = startGame(created, {
      actorUserId: "u1",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: new Date("2026-01-01T12:00:00Z"),
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const atStair = selectSpotType(game, actor("u1"), "stair")
    const blocked = selectLevel(atStair, actor("u1"), 5, [])
    const changed = selectSpotType(blocked, actor("u1"), "rails")
    expect(changed.currentRound?.status).toBe("selecting_level")
    expect(changed.currentRound?.level).toBeNull()
    expect(changed.nextLevel).toBeNull()
    const reopened = selectLevel(changed, actor("u1"), 2, [])
    expect(reopened.currentRound?.status).toBe("challenge_open")
  })

  it("resets the trick pool and reuses the smallest id once exhausted", () => {
    const catalog = catalogForDiscipline("roller")
    const rollerRailsL1 = catalog.tricks
      .filter((trick) => trick.level === 1 && trick.compatibleSpotTypes.includes("rails"))
      .map((trick) => trick.id)
      .sort()
    const first = selectTrickForSpotType("roller", "rails", 1, [])
    expect(rollerRailsL1).toContain(first.sourceId)
    expect(first.sourceId).toBe(rollerRailsL1[0])
    const reset = selectTrickForSpotType("roller", "rails", 1, rollerRailsL1)
    expect(reset.sourceId).toBe(rollerRailsL1[0])
    const second = selectTrickForSpotType("roller", "rails", 1, [rollerRailsL1[0] as string])
    expect(second.sourceId).toBe(rollerRailsL1[1])
  })

  it("selects a different skateboard trick when the configured pair has alternatives", () => {
    const catalog = catalogForDiscipline("skateboard")
    const eligible = catalog.tricks.filter(
      (trick) => trick.level === 1 && trick.compatibleSpotTypes.includes("plaza"),
    )
    expect(eligible.length).toBeGreaterThan(1)

    const first = selectTrickForSpotType("skateboard", "plaza", 1, [])
    const second = selectTrickForSpotType("skateboard", "plaza", 1, [first.sourceId])

    expect(second.sourceId).not.toBe(first.sourceId)
  })

  it("retrieves alternatives without reusing excluded tricks", () => {
    const first = selectTrickForSpotType("skateboard", "plaza", 1, [])
    const second = selectAlternativeTrickForSpotType("skateboard", "plaza", 1, [first.sourceId])
    const third = selectAlternativeTrickForSpotType(
      "skateboard",
      "plaza",
      1,
      [first.sourceId, second.sourceId],
    )

    expect(second.sourceId).not.toBe(first.sourceId)
    expect(third.sourceId).not.toBe(first.sourceId)
    expect(third.sourceId).not.toBe(second.sourceId)
  })
})

describe("challenge game engine — guest identity", () => {
  it("lets a guest leader run the whole training round", () => {
    const started = startGame(trainingLobby(), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const selectedType = selectSpotType(started, guestActor("tok-aaa"), "ledges")
    const selectedLevel = selectLevel(selectedType, guestActor("tok-aaa"), 1, [])
    const responsePhase = submitChallengerResult(selectedLevel, guestActor("tok-aaa"), "landed")
    const resolved = submitResponse(responsePhase, guestActor("tok-bbb"), "landed")
    expect(resolved.currentRound?.status).toBe("resolved")
  })

  it("denies a guest who is not the leader", () => {
    const started = startGame(trainingLobby(), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    expect(() => selectSpotType(started, guestActor("tok-bbb"), "ledges")).toThrow(GameDomainError)
    const game = selectLevel(selectSpotType(started, guestActor("tok-aaa"), "rails"), guestActor("tok-aaa"), 1, [])
    expect(() => submitChallengerResult(game, guestActor("tok-bbb"), "landed")).toThrow(GameDomainError)
  })

  it("denies an authenticated identity acting as a guest player", () => {
    const started = startGame(trainingLobby(), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    expect(() => selectSpotType(started, actor("u1"), "ledges")).toThrow(GameDomainError)
  })

  it("lets the guest challenger fail and rotate to the next guest", () => {
    const started = startGame(trainingLobby(), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const game = selectLevel(selectSpotType(started, guestActor("tok-aaa"), "rails"), guestActor("tok-aaa"), 1, [])
    const next = submitChallengerResult(game, guestActor("tok-aaa"), "failed")
    expect(next.currentChallengerPlayerId).toBe("p2")
    expect(() => submitResponse(next, guestActor("tok-bbb"), "landed")).toThrow(GameDomainError)
  })

  it("denies a guest responder outside the required set", () => {
    const started = startGame(trainingLobby([guestPlayers[0] as Player, guestPlayers[1] as Player]), {
      actorUserId: "tok-aaa",
      verifiedPlayerIds: ["p1", "p2"],
      scheduledStartAt: null,
      now: new Date("2026-01-01T12:00:00Z"),
    })
    const game = selectLevel(selectSpotType(started, guestActor("tok-aaa"), "rails"), guestActor("tok-aaa"), 1, [])
    const responsePhase = submitChallengerResult(game, guestActor("tok-aaa"), "landed")
    expect(() => submitResponse(responsePhase, guestActor("tok-aaa"), "landed")).toThrow(GameDomainError)
  })
})

describe("challenge game engine — eligibility snapshots", () => {
  it("uses the frozen snapshot, not live activity, for round eligibility", () => {
    const frozen = { ...challengeGame(), currentRound: { ...challengeGame().currentRound!, eligiblePlayerIds: ["p1", "p2"] } }
    const responsePhase = submitChallengerResult(frozen, actor("u1"), "landed")
    expect(responsePhase.currentRound?.requiredResponsePlayerIds).toEqual(["p2"])
    expect(() => submitResponse(responsePhase, actor("u3"), "landed")).toThrow(GameDomainError)
  })

  it("rejects a challenger outside the frozen snapshot", () => {
    const frozen = { ...challengeGame(), currentRound: { ...challengeGame().currentRound!, eligiblePlayerIds: ["p2"] } }
    expect(() => submitChallengerResult(frozen, actor("u1"), "landed")).toThrow(GameDomainError)
  })

  it("pauses in place when the frozen snapshot has fewer than two survivors", () => {
    const game = challengeGame()
    const resolved = submitResponse(submitChallengerResult(game, actor("u1"), "landed"), actor("u2"), "landed")
    const paused = prepareNextRound({
      ...resolved,
      currentRound: { ...resolved.currentRound!, eligiblePlayerIds: ["p1"] },
    })
    expect(paused.currentRound?.id).toBe(game.currentRound?.id)
    expect(paused.currentRound?.status).toBe("paused")
  })
})
