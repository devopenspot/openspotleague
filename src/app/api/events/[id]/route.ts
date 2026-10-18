import { NextResponse, type NextRequest } from "next/server"
import { findEventById } from "@/lib/services/event/events"
import { log } from "@/lib/utils/log"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  try {
    const event = await findEventById(id)
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }
    const res = NextResponse.json(event)
    // Public item — CDN absorbs detail + unfurl polling.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  } catch (err) {
    log.error(
      "api.events.find_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
