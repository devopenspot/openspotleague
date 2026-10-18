import { NextResponse, type NextRequest } from "next/server"
import { gameErrorResponse, identityErrorResponse, resolveIdentity } from "@/app/api/games/identity"
import { enforceRateLimit } from "@/app/api/games/rate-limit"
import { levelMutationInputSchema } from "@/lib/schemas/game"
import { selectGameLevel } from "@/lib/services/games"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; roundId: string }> }) {
  let identity
  try { identity = await resolveIdentity(request) } catch (error) { return identityErrorResponse(error) }
  const { id, roundId } = await context.params
  try { enforceRateLimit(request, identity) } catch (error) { return gameErrorResponse(error) }
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const parsed = levelMutationInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  try {
    return NextResponse.json(await selectGameLevel(identity, id, { ...parsed.data, roundId }))
  } catch (error) {
    return gameErrorResponse(error)
  }
}
