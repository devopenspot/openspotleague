import { NextResponse, type NextRequest } from "next/server"
import { findSpotById } from "@/lib/services/spot/spots"
import { log } from "@/lib/utils/log"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  try {
    const spot = await findSpotById(id)
    if (!spot) {
      return NextResponse.json({ error: "Spot not found" }, { status: 404 })
    }
    const res = NextResponse.json(spot)
    // Public item — CDN absorbs detail + unfurl polling.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  } catch (err) {
    log.error(
      "api.spots.find_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
