import { NextResponse, type NextRequest } from "next/server"
import { getGameHistory } from "@/lib/services/games"
import {
  gameErrorResponse,
  identityErrorResponse,
  resolveIdentity,
} from "@/app/api/games/identity"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let identity
  try {
    identity = await resolveIdentity(request, { allowAnonymous: true })
  } catch (error) {
    return identityErrorResponse(error)
  }

  const { id } = await params
  const query = request.nextUrl.searchParams
  const rawLimit = query.get("limit")
  const limit = rawLimit === null ? undefined : Number(rawLimit)
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
    return NextResponse.json({ error: "Invalid history limit" }, { status: 400 })
  }

  try {
    return NextResponse.json(await getGameHistory(identity, id, {
      shareCode: query.get("share") ?? undefined,
      limit,
      roundCursor: query.get("roundCursor") ?? undefined,
      lapCursor: query.get("lapCursor") ?? undefined,
    }))
  } catch (error) {
    return gameErrorResponse(error)
  }
}
