import { NextResponse, type NextRequest } from "next/server"
import { joinGame } from "@/lib/services/games"
import { joinGameInputSchema } from "@/lib/schemas/game"
import { gameErrorResponse, identityErrorResponse, resolveIdentity } from "@/app/api/games/identity"
import { enforceRateLimit } from "@/app/api/games/rate-limit"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
    return NextResponse.json({ error: "A guest name is required to join a game" }, { status: 400 })
  }
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: "Missing game id" }, { status: 400 })
  try { enforceRateLimit(request, identity) } catch (error) { return gameErrorResponse(error) }
  let body: unknown = {}
  try {
    if (request.headers.get("content-type")?.includes("application/json")) body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = joinGameInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  try {
    return NextResponse.json(await joinGame(identity, id, parsed.data), { status: 200 })
  } catch (error) {
    return gameErrorResponse(error)
  }
}
