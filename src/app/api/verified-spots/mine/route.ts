import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/server"
import { listVerifiedSpotsWithDetailsForUser } from "@/lib/services/spot/verified-spots"
import { log } from "@/lib/utils/log"

/**
 * Authenticated read-only endpoint: the signed-in user's verified
 * spots joined with full spot entities. Powers the Saved tab's
 * verified grid without cross-referencing the capped client
 * directory — a verified spot outside that directory (and its
 * `countrySpots` overlay) still renders. Distinct from
 * `GET /api/verified-spots` (per-spot count/isVerified check).
 */
export async function GET() {
  let user
  try {
    user = await requireUser()
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized"
    log.warn("api.verified_spots.mine_unauthorized", msg)
    return NextResponse.json({ error: msg }, { status: 401 })
  }
  try {
    const result = await listVerifiedSpotsWithDetailsForUser(user.id, {
      limit: 200,
    })
    return NextResponse.json(result)
  } catch (err) {
    log.error(
      "api.verified_spots.mine_list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
