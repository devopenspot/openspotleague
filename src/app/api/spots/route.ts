import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { SpotQuerySchema } from "@/lib/schemas/spot"
import { listSpots, listSpotCards } from "@/lib/services/spot/spots"
import { createPersonalSpot, findNearbyPublicSpots } from "@/lib/services/spot/community-spots"
import { log } from "@/lib/utils/log"
import { mapDomainErrorToResponse } from "@/lib/api/error"
import { requireUser } from "@/lib/auth/server"
import { isRateLimited, rateLimitKey } from "@/lib/api/rate-limit"
import { COMMUNITY_RADIUS_METERS, MAX_LOCATION_ACCURACY_METERS, MAX_UPLOAD_BYTES } from "@/lib/config/constants"
import { UploadValidationError } from "@/lib/storage/errors"
import { uploadSpotImage, deleteSpotImage } from "@/lib/storage"

// Coerces comma-separated `types` and `ids` query params into arrays.
// `SpotQuerySchema.types` and `.ids` are `z.array(...)`, so the default
// `safeParse` would reject `?types=skatepark,bowl` as a string. This
// transform pre-shapes the input so the existing schema accepts it.
const Query = z
  .object({
    q: SpotQuerySchema.shape.q,
    types: z
      .string()
      .optional()
      .transform((v) =>
        v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      )
      .pipe(SpotQuerySchema.shape.types),
    country: SpotQuerySchema.shape.country,
    countryCode: SpotQuerySchema.shape.countryCode,
    discipline: SpotQuerySchema.shape.discipline,
    city: SpotQuerySchema.shape.city,
    scope: z
      .string()
      .optional()
      .transform((v) => (v ? v.trim() : undefined))
      .pipe(SpotQuerySchema.shape.scope),
    ids: z
      .string()
      .optional()
      .transform((v) =>
        v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      )
      .pipe(SpotQuerySchema.shape.ids),
    near: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined
        const [latStr, lonStr, radiusStr] = v.split(",")
        if (!latStr || !lonStr || !radiusStr) {
          ctx.addIssue({ code: "custom", message: "near must use lat,lon,radiusMeters" })
          return z.NEVER
        }
        const lat = Number(latStr)
        const lon = Number(lonStr)
        const radiusMeters = Number(radiusStr)
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusMeters)) {
          ctx.addIssue({ code: "custom", message: "near must use lat,lon,radiusMeters" })
          return z.NEVER
        }
        return { lat, lon, radiusMeters }
      })
      .pipe(SpotQuerySchema.shape.near),
    cursor: SpotQuerySchema.shape.cursor,
    seed: SpotQuerySchema.shape.seed,
    random: z
      .string()
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        if (v === "true" || v === "1") return true
        if (v === "false" || v === "0") return false
        return v as unknown as boolean
      })
      .pipe(SpotQuerySchema.shape.random),
    hasImage: z
      .string()
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        if (v === "true" || v === "1") return true
        if (v === "false" || v === "0") return false
        return v as unknown as boolean
      })
      .pipe(SpotQuerySchema.shape.hasImage),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : undefined))
      .pipe(SpotQuerySchema.shape.limit),
  })
  .strict()

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const raw: Record<string, string> = {}
  for (const [k, v] of url.searchParams.entries()) raw[k] = v

  const parsed = Query.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // scope=created is authenticated and returns owned spots (personal + promoted)
  if (parsed.data.scope === "created") {
    let user
    try {
      user = await requireUser()
    } catch {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 })
    }
    try {
      const { listCreatedSpots } = await import("@/lib/services/spot/community-spots")
      const result = await listCreatedSpots(user.id, parsed.data)
      return NextResponse.json(result)
    } catch (err) {
      log.error("api.spots.list_created_failed", err instanceof Error ? err.message : err)
      const { status, body } = mapDomainErrorToResponse(err)
      return NextResponse.json(body, { status })
    }
  }

  try {
    // Seeded shuffle path (landing wire): slim card rows backed by the
    // filter-keyed shuffle-ID cache. Cards carry no `createdBy`, so no
    // stripping is needed.
    if (parsed.data.random && parsed.data.seed && !parsed.data.near) {
      const result = await listSpotCards(parsed.data)
      const res = NextResponse.json(result)
      res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
      return res
    }
    const result = await listSpots(parsed.data)
    // Strip anonymous creator for public directory reads
    const stripped = {
      ...result,
      items: result.items.map((s) => ({ ...s, createdBy: null })),
    }
    const res = NextResponse.json(stripped)
    // Public directory read — CDN absorbs map/search polling. Authenticated
    // scope=created branch above intentionally stays uncached (private data).
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300")
    return res
  } catch (err) {
    log.error(
      "api.spots.list_failed",
      err instanceof Error ? err.message : err,
    )
    const { status, body } = mapDomainErrorToResponse(err)
    return NextResponse.json(body, { status })
  }
}

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 })
  }

  if (isRateLimited(rateLimitKey("spot-create", user.id), 10)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": "60" } })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const name = String(form.get("name") ?? "").trim()
  const city = String(form.get("city") ?? "").trim()
  const address = String(form.get("address") ?? "").trim()
  const country = String(form.get("country") ?? "").trim()
  const countryCodeRaw = String(form.get("countryCode") ?? "").trim()
  const countryCode = countryCodeRaw || undefined
  const instagramRaw = String(form.get("instagram") ?? "").trim()
  const instagram = instagramRaw || undefined
  const latRaw = String(form.get("lat") ?? "").trim()
  const lonRaw = String(form.get("lon") ?? "").trim()
  const accuracyRaw = String(form.get("accuracy") ?? "").trim()
  const confirmRaw = String(form.get("confirm") ?? "").trim()
  const confirm = confirmRaw === "true" || confirmRaw === "1"
  const sportsRaw = String(form.get("sports") ?? "").trim()
  const typesRaw = String(form.get("types") ?? "").trim()
  const sports = sportsRaw ? sportsRaw.split(",").map((s) => s.trim()).filter(Boolean) : []
  const types = typesRaw ? typesRaw.split(",").map((s) => s.trim()).filter(Boolean) : []
  const imageFile = form.get("image")

  if (!name || !city || !address) {
    return NextResponse.json({ error: "Missing required fields: name, city, address" }, { status: 400 })
  }
  if (!country && !countryCode) {
    return NextResponse.json({ error: "Country is required" }, { status: 400 })
  }
  const lat = Number(latRaw)
  const lon = Number(lonRaw)
  const accuracy = accuracyRaw ? Number(accuracyRaw) : undefined
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "Current location is required (lat/lon)" }, { status: 400 })
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
  }
  if (accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy > MAX_LOCATION_ACCURACY_METERS)) {
    return NextResponse.json({ error: "Location accuracy too low. Move closer and try again." }, { status: 400 })
  }
  if (accuracy === undefined) {
    return NextResponse.json({ error: "Location accuracy is required" }, { status: 400 })
  }
  if (!(imageFile instanceof File)) {
    return NextResponse.json({ error: "Image is required" }, { status: 400 })
  }
  if (imageFile.size === 0 || imageFile.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Images must be between 1 byte and 5 MB" }, { status: 400 })
  }

  // Dedup check before upload: 300m radius public spots
  if (!confirm) {
    try {
      const candidates = await findNearbyPublicSpots({ lat, lon, radiusMeters: COMMUNITY_RADIUS_METERS })
      if (candidates.length > 0) {
        return NextResponse.json({ code: "NEARBY_CANDIDATES", candidates: candidates.map((s) => ({ ...s, createdBy: null })) }, { status: 409 })
      }
    } catch (err) {
      log.warn("api.spots.nearby_check_failed", err instanceof Error ? err.message : String(err))
    }
  }

  const spotId = crypto.randomUUID()
  let uploadedPath: string | undefined
  let imageUrl: string | undefined
  try {
    const uploaded = await uploadSpotImage(imageFile, spotId)
    uploadedPath = uploaded.path
    imageUrl = uploaded.url
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    log.error("api.spots.upload_failed", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: "Image upload failed" }, { status: 400 })
  }

  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  try {
    const spot = await createPersonalSpot({
      id: spotId,
      slug: `${citySlug}-${Date.now()}`,
      name,
      city,
      citySlug,
      address,
      country,
      countryCode,
      sports: sports as unknown as string[],
      types,
      image: imageUrl!,
      location: { lat, lon },
      createdBy: user.id,
      instagram: instagram ?? null,
    } as unknown as Parameters<typeof createPersonalSpot>[0])
    return NextResponse.json({ spot }, { status: 201 })
  } catch (err) {
    if (uploadedPath) {
      await deleteSpotImage(uploadedPath).catch(() => undefined)
    }
    if (err instanceof Error && err.message.includes("Country not found")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes("Sport discipline")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof Error && err.message.includes("Spot type")) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    log.error("api.spots.create_failed", err instanceof Error ? err.message : String(err))
    const { status, body } = mapDomainErrorToResponse(err)
    return NextResponse.json(body, { status })
  }
}
