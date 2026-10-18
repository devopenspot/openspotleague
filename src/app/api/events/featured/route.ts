import { NextResponse } from "next/server"
import { findFeaturedEvent } from "@/lib/services/event/events"
import { log } from "@/lib/utils/log"

export async function GET() {
  try {
    const event = await findFeaturedEvent()
    if (!event) {
      return NextResponse.json({ error: "No featured event" }, { status: 404 })
    }
    const res = NextResponse.json(event)
    // Single public event — CDN absorbs polling.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  } catch (err) {
    log.error(
      "api.events.featured_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
