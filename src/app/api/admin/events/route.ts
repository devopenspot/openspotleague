import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
  requireEventCurationAccess,
} from "@/lib/auth/server"
import { NewSportEventSchema } from "@/lib/schemas/event"
import { createEvent } from "@/lib/services/event/events"
import { log } from "@/lib/utils/log"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { UploadValidationError, deleteEventImage, uploadEventImage, uploadEventImageFromUrl } from "@/lib/storage"
import { setUpdatedAtHeaders } from "@/lib/admin/concurrency"
import { mapMutationErrorResponse } from "@/lib/api/admin-handler"
import { isInvalidReferenceError } from "@/lib/repositories/core/errors"

export async function POST(request: NextRequest) {
  let user
  try {
    user = await requireCurationAccess(["content.write", "media.manage"])
  } catch (err) {
    return authorizationErrorResponse(err)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    )
  }

  const fileEntry = form.get("image")
  const file =
    fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null

  const rawExternalUrlEntry = form.get("imageUrl")
  const rawExternalUrl =
    typeof rawExternalUrlEntry === "string" ? rawExternalUrlEntry.trim() : ""

  let providedId: string | undefined
  let imagePath: string | null = null
  let imageUrl = ""
  if (file) {
    try {
      providedId = crypto.randomUUID()
      const uploaded = await uploadEventImage(file, providedId)
      imagePath = uploaded.path
      imageUrl = uploaded.url
    } catch (err) {
      log.error(
        "api.admin.events.upload_failed",
        err instanceof Error ? err.message : "Image upload failed",
      )
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      if (err instanceof TimeoutError || isConnectionError(err)) {
        return NextResponse.json({ error: "Storage is temporarily unavailable" }, { status: 503 })
      }
      return NextResponse.json(
        { error: "Image upload failed" },
        { status: 502 },
      )
    }
  } else if (rawExternalUrl) {
    const isPlaceholder = rawExternalUrl.includes("placeholder.local")
    const isHttpUrl = /^https?:\/\//i.test(rawExternalUrl)
    if (isHttpUrl && !isPlaceholder) {
      try {
        providedId = crypto.randomUUID()
        const uploaded = await uploadEventImageFromUrl(rawExternalUrl, providedId)
        imagePath = uploaded.path
        imageUrl = uploaded.url
      } catch (err) {
        log.error("api.admin.events.remote_upload_failed", err instanceof Error ? err.message : "Image upload failed")
        if (err instanceof UploadValidationError) {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
        if (err instanceof TimeoutError || isConnectionError(err)) {
          return NextResponse.json({ error: "Storage is temporarily unavailable" }, { status: 503 })
        }
        return NextResponse.json({ error: "Image upload failed" }, { status: 502 })
      }
    }
  }

  const strField = (k: string) => {
    const v = form.get(k)
    return typeof v === "string" ? v : ""
  }
  const numField = (k: string) => {
    const value = strField(k).trim()
    if (!value) return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  const strListField = (k: string) =>
    form.getAll(k).filter((v): v is string => typeof v === "string")

  const country = strField("country")
  const countryCode = strField("countryCode").toUpperCase()
  const instagramRaw = strField("instagram").trim()
  const instagram = instagramRaw ? instagramRaw : null
  const youtubeRaw = strField("youtube").trim()
  const youtube = youtubeRaw ? youtubeRaw : null

  const raw = {
    id: providedId,
    name: strField("name"),
    shortName: strField("shortName") || undefined,
    url: strField("url"),
    // If we ingested a remote URL, `imageUrl` already holds the stored
    // placeholder URL (imagePath is set). Otherwise fall back to the raw
    // external URL verbatim – Zod will validate it or fail with 400.
    image: imageUrl || rawExternalUrl,
    imagePath: imagePath ?? undefined,
    description: strField("description"),
    sports: strListField("sports"),
    startDate: strField("startDate"),
    endDate: strField("endDate") || undefined,
    city: strField("city"),
    citySlug: strField("citySlug") || undefined,
    address: strField("address") || undefined,
    country,
    countryCode: countryCode || undefined,
    venue: strField("venue") || undefined,
    latitude: numField("latitude"),
    longitude: numField("longitude"),
    category: strField("category"),
    featured: strField("featured") === "on",
    instagram,
    youtube,
    createdBy: user.id,
  }

  const parsed = NewSportEventSchema.safeParse(raw)
  if (!parsed.success) {
    if (imagePath) await deleteEventImage(imagePath).catch(() => undefined)
    return NextResponse.json(
      { error: "Invalid event", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  if (parsed.data.latitude === undefined || parsed.data.longitude === undefined) {
    return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 })
  }

  // Scoped event curator: fail-closed — every creation must be scope-checked.
  {
    let scopeCountry: string
    try {
      const { resolveScopeCountryCode } = await import("@/lib/services/country-scope")
      scopeCountry = await resolveScopeCountryCode({
        countryCode: parsed.data.countryCode,
        country: parsed.data.country,
      })
    } catch (err) {
      if (imagePath) await deleteEventImage(imagePath).catch(() => undefined)
      if (err instanceof TimeoutError || isConnectionError(err)) {
        return NextResponse.json({ error: "The events service is temporarily unavailable" }, { status: 503 })
      }
      const msg = err instanceof Error ? err.message : "countryCode is required"
      const status = (err as { status?: number }).status ?? 400
      return NextResponse.json({ error: msg }, { status })
    }
    try {
      await requireEventCurationAccess(scopeCountry, ["content.write", "media.manage"])
    } catch (e) {
      if (imagePath) await deleteEventImage(imagePath).catch(() => undefined)
      return authorizationErrorResponse(e)
    }
  }

  try {
    const event = await createEvent(parsed.data)
    return setUpdatedAtHeaders(NextResponse.json(event, { status: 201 }), event.updatedAt)
  } catch (err) {
    if (imagePath) await deleteEventImage(imagePath).catch(() => undefined)
    if (isInvalidReferenceError(err)) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof UploadValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return mapMutationErrorResponse(err, {
      serviceName: "events",
      notFoundPrefixes: [],
      logLabel: "api.admin.events.create_failed",
      log: log.error,
    })
  }
}
