import { type NextRequest, NextResponse } from "next/server"
import { getGameCreationOptions } from "@/lib/services/games"
import { disciplineSlugSchema, gameCreationOptionsSchema } from "@/lib/schemas/game"
import { log } from "@/lib/utils/log"

export async function GET(request: NextRequest) {
  const discipline = disciplineSlugSchema.safeParse(
    request.nextUrl.searchParams.get("disciplineSlug"),
  )
  if (!discipline.success) {
    return NextResponse.json({ error: "A valid discipline is required" }, { status: 400 })
  }

  try {
    const options = await getGameCreationOptions(discipline.data)
    const res = NextResponse.json(gameCreationOptionsSchema.parse(options))
    // Catalog-derived, discipline-keyed — safe to cache.
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
    return res
  } catch (error) {
    log.error(
      "api.games.options_failed",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json({ error: "Game options could not be loaded" }, { status: 500 })
  }
}
