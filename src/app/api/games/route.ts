import { NextResponse, type NextRequest } from "next/server"
import { createGame, listGamesForUser, listOpenTrainingGames } from "@/lib/services/games"
import { requireUser } from "@/lib/auth/server"
import { createGameInputSchema } from "@/lib/schemas/game"
import { gameErrorResponse, identityErrorResponse, resolveIdentity } from "@/app/api/games/identity"
import { clientIp } from "@/lib/api/rate-limit"
import { enforceRateLimit } from "@/app/api/games/rate-limit"
import { log } from "@/lib/utils/log"

export async function POST(request: NextRequest) {
  let identity
  try {
    identity = await resolveIdentity(request)
  } catch (error) {
    return identityErrorResponse(error)
  }
  if (!identity.userId && !identity.guestToken) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }
  if (!identity.userId && !identity.name) {
    return NextResponse.json({ error: "A guest name is required to create a game" }, { status: 400 })
  }
  try { enforceRateLimit(request, identity) } catch (error) { return gameErrorResponse(error) }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = createGameInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  try {
    const result = await createGame(identity, parsed.data, { ip: clientIp(request) })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return gameErrorResponse(error, () => log.error("Unexpected error creating game:", error))
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("mode") === "training" && request.nextUrl.searchParams.get("status") === "open") {
    try {
      const identity = await resolveIdentity(request)
      if (!identity.userId && !identity.guestToken) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }
      return NextResponse.json(await listOpenTrainingGames(identity))
    } catch (error) {
      return identityErrorResponse(error)
    }
  }
  try {
    const user = await requireUser()
    const rawLimit = request.nextUrl.searchParams.get("limit")
    const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 20
    if (Number.isNaN(limit)) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 })
    }
    return NextResponse.json(await listGamesForUser(user.id, Math.min(100, Math.max(1, limit))))
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
