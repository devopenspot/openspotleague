import { NextResponse, type NextRequest } from "next/server"
import { runNotificationTick } from "@/lib/notifications/delivery/service"
import { log } from "@/lib/utils/log"
import { readSignedBody } from "../signed"

/**
 * The 15-minute notification tick, called by the `tick` Lambda that
 * EventBridge Scheduler runs (infra/aws). Signed with
 * NOTIFICATIONS_INTERNAL_SECRET; see docs/notifications.md.
 */
export async function POST(request: NextRequest) {
  const signed = await readSignedBody(request)
  if ("response" in signed) return signed.response
  try {
    const result = await runNotificationTick()
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    log.error("notifications.tick_failed", error)
    return NextResponse.json({ error: "TICK_FAILED" }, { status: 500 })
  }
}
