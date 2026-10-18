import { NextResponse, type NextRequest } from "next/server"
import { gameErrorResponse, identityErrorResponse, resolveIdentity } from "@/app/api/games/identity"
import { enforceRateLimit } from "@/app/api/games/rate-limit"
import { challengeSettingsMutationInputSchema } from "@/lib/schemas/game"
import { selectGameChallengeSettings } from "@/lib/services/games"

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; roundId: string }> }) {
  let identity
  try { identity = await resolveIdentity(request) } catch (error) { return identityErrorResponse(error) }
  const { id, roundId } = await context.params
  try { enforceRateLimit(request, identity) } catch (error) { return gameErrorResponse(error) }
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) }
  const parsed = challengeSettingsMutationInputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 })
  try {
    return NextResponse.json(await selectGameChallengeSettings(identity, id, { ...parsed.data, roundId }))
  } catch (error) {
    return gameErrorResponse(error)
  }
}
