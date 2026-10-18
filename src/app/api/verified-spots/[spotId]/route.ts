import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { unverifySpotForUser } from "@/lib/services/spot/verified-spots"
import { log } from "@/lib/utils/log"

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ spotId: string }> },
) {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    log.warn("api.verified_spots.delete_unauthorized", msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }
  const { spotId } = await context.params
  if (!spotId) {
    return NextResponse.json({ error: "Missing spotId" }, { status: 400 })
  }
  try {
    // Echo the post-trigger `verification_count` so the client can
    // correct its optimistic value (handles concurrent toggles by
    // other users). 200 + body replaces the previous 204 — the
    // client reads `count` from the JSON either way.
    const count = await unverifySpotForUser(user.id, spotId)
    return NextResponse.json({ ok: true, count, isVerified: false })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    log.error("api.verified_spots.unverify_failed", msg)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
