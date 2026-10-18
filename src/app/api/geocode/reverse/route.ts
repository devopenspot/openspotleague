import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import {
  authorizationErrorResponse,
  requireCurationAccess,
} from "@/lib/auth/server"
import { env } from "@/lib/config/env"
import { log } from "@/lib/utils/log"
import { projectAddress, type NominatimResponse } from "@/lib/geocode/project"

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

const REVERSE_TIMEOUT_MS = 8_000

export async function GET(request: NextRequest) {
  try {
    await requireCurationAccess("content.write")
  } catch (err) {
    return authorizationErrorResponse(err)
  }

  const url = new URL(request.url)
  const latStr = url.searchParams.get("lat")
  const lonStr = url.searchParams.get("lon")
  if (!latStr || !lonStr) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }
  const parsed = Query.safeParse({ lat: latStr, lon: lonStr })
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }

  const { lat, lon } = parsed.data
  const nominatim = `${env.NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18`

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), REVERSE_TIMEOUT_MS)
  try {
    const r = await fetch(nominatim, {
      headers: {
        "User-Agent": env.NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      // Nominatim enforces a 1 req/sec policy; do not cache.
      cache: "no-store",
      signal: ac.signal,
    })
    if (!r.ok) {
      const upstreamBody = (await r.text()).slice(0, 300)
      log.warn("geocode.reverse_failed", {
        status: r.status,
        lat,
        lon,
        body: upstreamBody,
      })
      return NextResponse.json(
        { error: "Reverse geocode failed" },
        { status: 502 },
      )
    }
    const raw = (await r.json()) as NominatimResponse & { error?: string }
    if (raw.error) {
      log.warn("geocode.reverse_no_data", { lat, lon, upstream: raw.error })
      return NextResponse.json(
        { error: "No address found for these coordinates" },
        { status: 404 },
      )
    }
    return NextResponse.json({ address: projectAddress(raw) })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const isAbort =
      e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError")
    if (isAbort) {
      log.warn("geocode.reverse_timeout", { message })
      return NextResponse.json(
        { error: "Reverse geocode timed out" },
        { status: 504 },
      )
    }
    log.error("geocode.reverse_threw", message)
    return NextResponse.json(
      { error: "Reverse geocode unavailable" },
      { status: 502 },
    )
  } finally {
    clearTimeout(timer)
  }
}
