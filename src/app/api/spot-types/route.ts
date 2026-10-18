import { NextResponse } from "next/server"
import { listSpotTypes } from "@/lib/services/spot/spot-types"
import { log } from "@/lib/utils/log"

export async function GET() {
  try {
    const types = await listSpotTypes()
    const res = NextResponse.json({ items: types })
    // Public taxonomy — changes only via admin, cache long.
    res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=600")
    return res
  } catch (err) {
    log.error(
      "api.spot_types.list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
