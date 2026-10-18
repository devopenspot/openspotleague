import { NextResponse, type NextRequest } from "next/server"
import { listCitiesForCountry } from "@/lib/services/spot/cities"
import { log } from "@/lib/utils/log"

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")?.trim()
  if (!country) {
    return NextResponse.json(
      { error: "Country is required" },
      { status: 400 },
    )
  }
  try {
    const cities = await listCitiesForCountry(country)
    const res = NextResponse.json({ country, cities })
    // Country-keyed directory data — stable, safe to cache longer.
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
    return res
  } catch (err) {
    log.error(
      "api.spots.cities.list_failed",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
