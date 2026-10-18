import "../src/db/load-env"
import { cancelGame, createGame, getGameState, joinGame, startGame } from "../src/lib/services/games"

const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 18)
const creator = {
  userId: null,
  guestToken: `phase7-lifecycle-creator-${suffix}`,
  name: "Lifecycle Creator",
}
const rider = {
  userId: null,
  guestToken: `phase7-lifecycle-rider-${suffix}`,
  name: "Lifecycle Rider",
}

let gameId: string | null = null
let latestVersion: number | null = null

function errorDetails(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < 8 && current; depth += 1) {
    if (current instanceof Error) {
      const details = current as Error & {
        code?: string
        detail?: string
        constraint?: string
      }
      parts.push(
        [
          details.message,
          details.code ? `code=${details.code}` : null,
          details.constraint ? `constraint=${details.constraint}` : null,
          details.detail ? `detail=${details.detail}` : null,
        ]
          .filter(Boolean)
          .join(" "),
      )
      current = details.cause
    } else {
      parts.push(String(current))
      break
    }
  }
  return parts.join(" | ")
}

async function main() {
  const created = await createGame(
    creator,
    {
      mode: "training",
      disciplineSlug: "bmx",
      spotType: "bmx-dirt",
      level: 1,
      expectedVersion: 0,
      idempotencyKey: crypto.randomUUID(),
    },
    { ip: `phase7-lifecycle-${suffix}` },
  )
  gameId = created.id
  latestVersion = created.version

  const lobby = await getGameState(creator, gameId)
  if (!lobby) throw new Error("The created lobby could not be loaded")

  const joined = await joinGame(rider, gameId, {
    shareCode: lobby.shareCode,
    expectedVersion: latestVersion,
    idempotencyKey: crypto.randomUUID(),
  })
  latestVersion = joined.version

  const started = await startGame(creator, gameId, {
    expectedVersion: latestVersion,
    idempotencyKey: crypto.randomUUID(),
  })
  latestVersion = started.version
  if (started.status !== "active") throw new Error(`Expected active game, received ${started.status}`)

  const repeated = await startGame(creator, gameId, {
    expectedVersion: latestVersion,
    idempotencyKey: crypto.randomUUID(),
  })
  if (repeated.status !== "active" || repeated.version !== latestVersion) {
    throw new Error("Repeated start did not return the authoritative active state")
  }

  console.log(JSON.stringify({ ok: true, gameId, createdVersion: created.version, joinedVersion: joined.version, activeVersion: started.version }))
}

async function cleanup() {
  if (!gameId || latestVersion === null) return
  await cancelGame(creator, gameId, {
    expectedVersion: latestVersion,
    idempotencyKey: crypto.randomUUID(),
  })
}

main()
  .catch((error) => {
    console.error("challenge-game lifecycle verification failed:", errorDetails(error))
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await cleanup()
    } catch (error) {
      console.error("challenge-game lifecycle cleanup failed:", error instanceof Error ? error.message : error)
      process.exitCode = 1
    }
  })
