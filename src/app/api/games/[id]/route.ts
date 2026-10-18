import { NextResponse, type NextRequest } from "next/server"
import { getGameState } from "@/lib/services/games"
import { gameErrorResponse, identityErrorResponse, resolveIdentity } from "@/app/api/games/identity"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let identity
  try {
    identity = await resolveIdentity(_request, { allowAnonymous: true })
  } catch (error) {
    return identityErrorResponse(error)
  }
  const { id } = await context.params
  const requestUrl = new URL(_request.url)
  const shareCode = requestUrl.searchParams.get("share") ?? undefined
  const knownVersionValue = requestUrl.searchParams.get("version")
  const ifNoneMatch = _request.headers.get("if-none-match")
  const etagPrefix = `"game-${id}-`
  const etagVersion = ifNoneMatch?.startsWith(etagPrefix) && ifNoneMatch.endsWith('"')
    ? ifNoneMatch.slice(etagPrefix.length, -1)
    : undefined
  const requestedVersion = knownVersionValue ?? etagVersion ?? null
  const knownVersion = requestedVersion === null ? undefined : Number(requestedVersion)
  if (requestedVersion !== null && !Number.isInteger(knownVersion)) {
    return NextResponse.json({ error: "Invalid version" }, { status: 400 })
  }
  try {
    const state = await getGameState(identity, id, shareCode, knownVersion)
    if (state === null) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: `"game-${id}-${knownVersion}"` },
      })
    }
    const isTerminal = state.status === "complete" || state.status === "cancelled"
    return NextResponse.json(state, {
      headers: {
        "Cache-Control": isTerminal
          ? "private, max-age=300, stale-while-revalidate=3600"
          : "private, no-cache",
        ETag: `"game-${id}-${state.version}"`,
      },
    })
  } catch (error) {
    return gameErrorResponse(error)
  }
}
