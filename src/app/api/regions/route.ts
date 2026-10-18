import { NextResponse } from "next/server"
import { listRegions } from "@/lib/services/spot/regions"
import { log } from "@/lib/utils/log"

export async function GET() {
  try {
    const regions = await listRegions()
    const res = NextResponse.json({ items: regions })
    // Public taxonomy — changes only via admin, cache long.
    res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=600")
    return res
  } catch (err) {
    log.error(
      "api.regions.list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
