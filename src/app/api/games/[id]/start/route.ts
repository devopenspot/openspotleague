import { NextResponse, type NextRequest } from "next/server"
import { gameErrorResponse, identityErrorResponse, resolveIdentity } from "@/app/api/games/identity"
import { enforceRateLimit } from "@/app/api/games/rate-limit"
import { startGameMutationInputSchema } from "@/lib/schemas/game"
import { startGame } from "@/lib/services/games"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let identity
  try { identity = await resolveIdentity(request) } catch (error) { return identityErrorResponse(error) }
  const { id } = await context.params
  try { enforceRateLimit(request, identity) } catch (error) { return gameErrorResponse(error) }
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const parsed = startGameMutationInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  try {
    return NextResponse.json(await startGame(identity, id, parsed.data))
  } catch (error) {
    return gameErrorResponse(error)
  }
}
