import { NextResponse, type NextRequest } from "next/server"
import { listCitiesForCountry, searchCities } from "@/lib/services/spot/cities"
import { log } from "@/lib/utils/log"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  const country = request.nextUrl.searchParams.get("country")?.trim()
  const limitParam = request.nextUrl.searchParams.get("limit")

  if (q) {
    const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 50) : 10
    try {
      const cities = await searchCities(q, country || undefined, limit)
      const res = NextResponse.json({ cities })
      res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
      return res
    } catch (err) {
      log.error(
        "api.spots.cities.search_failed",
        err instanceof Error ? err.message : err,
      )
      return NextResponse.json({ error: "Internal error" }, { status: 500 })
    }
  }

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
