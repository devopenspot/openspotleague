import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
  requireEventCurationAccess,
} from "@/lib/auth/server"
import { SportEventPatchSchema } from "@/lib/schemas/event"
import {
  deleteEvent,
  findEventById,
  findEventMediaState,
  updateEvent,
} from "@/lib/services/event/events"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { resolveScopeCountryCode } from "@/lib/services/country-scope"
import { mapMutationErrorResponse } from "@/lib/api/admin-handler"
import { log } from "@/lib/utils/log"
import { deleteEventImage, uploadEventImage, uploadEventImageFromUrl } from "@/lib/storage"
import { getExpectedUpdatedAt, setUpdatedAtHeaders } from "@/lib/admin/concurrency"
import { mapUploadErrorToResponse, resolveAdminImagePatch } from "@/lib/storage/admin-image"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requireCurationAccess(["content.write", "media.manage"])
  } catch (err) {
    return authorizationErrorResponse(err)
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  let body: unknown
  let imageFile: File | null = null
  let expectedUpdatedAt: string | undefined
  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data") ?? false
  if (isMultipart) {
    const form = await request.formData()
    expectedUpdatedAt = getExpectedUpdatedAt(request, form)
    const value = (key: string) => {
      const entry = form.get(key)
      return typeof entry === "string" ? entry : ""
    }
    const imageEntry = form.get("image")
    imageFile = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null
    body = {
      name: value("name") || undefined, shortName: value("shortName") || undefined,
      url: value("url") || undefined, image: value("imageUrl") || undefined,
      description: value("description") || undefined,
      sports: form.getAll("sports").filter((entry): entry is string => typeof entry === "string"),
      startDate: value("startDate") || undefined, endDate: value("endDate") || null,
      city: value("city") || undefined, citySlug: value("citySlug") || undefined,
      address: value("address") || undefined, country: value("country") || undefined,
      countryCode: value("countryCode").toUpperCase() || undefined,
      venue: value("venue") || undefined,
      latitude: value("latitude") ? Number(value("latitude")) : undefined,
      longitude: value("longitude") ? Number(value("longitude")) : undefined,
      category: value("category") || undefined, featured: value("featured") === "on",
      instagram: value("instagram") || null, youtube: value("youtube") || null,
    }
  } else {
    expectedUpdatedAt = getExpectedUpdatedAt(request)
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
  }

  const parsed = SportEventPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid patch", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  if (!expectedUpdatedAt) {
    return NextResponse.json(
      { error: "If-Match is required for edits" },
      { status: 428 },
    )
  }
  if (isMultipart && (parsed.data.latitude === undefined || parsed.data.longitude === undefined)) {
    return NextResponse.json({ error: "Latitude and longitude are required" }, { status: 400 })
  }

  // Scope check: fail-closed — DB errors surface as 503, not silent bypass.
  try {
    const existing = await findEventById(id)
    if (!existing) return NextResponse.json({ error: `Sport event not found: ${id}` }, { status: 404 })
    const existingCountry = (existing.location.countryCode as string | undefined) ?? ""
    if (existingCountry) {
      try { await requireEventCurationAccess(existingCountry, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
    } else {
      try { await requireEventCurationAccess("", ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
    }
    let targetCountry = existingCountry
    const patchAny = parsed.data as { countryCode?: string; country?: string }
    if (patchAny.countryCode) targetCountry = patchAny.countryCode.toUpperCase()
    else if (patchAny.country) {
      try {
        targetCountry = await resolveScopeCountryCode({ country: patchAny.country })
      } catch (err) {
        if (err instanceof TimeoutError || isConnectionError(err)) {
          return NextResponse.json({ error: "The events service is temporarily unavailable" }, { status: 503 })
        }
        const msg = err instanceof Error ? err.message : "countryCode is required"
        const status = (err as { status?: number }).status ?? 400
        return NextResponse.json({ error: msg }, { status })
      }
    }
    if (targetCountry !== existingCountry) {
      const effectiveTarget = targetCountry || ""
      try { await requireEventCurationAccess(effectiveTarget, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
    }
  } catch (err) {
    if (err instanceof TimeoutError || isConnectionError(err)) {
      return NextResponse.json({ error: "The events service is temporarily unavailable" }, { status: 503 })
    }
    const { AuthorizationError } = await import("@/lib/services/profile/authorization")
    if (err instanceof AuthorizationError) return authorizationErrorResponse(err)
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Sport event not found")) return NextResponse.json({ error: msg }, { status: 404 })
    log.warn("api.admin.events.scope_check_failed", { id, error: msg })
    return NextResponse.json({ error: "The events service is temporarily unavailable" }, { status: 503 })
  }

  let uploadedPath: string | null = null
  let previousImagePath: string | null = null
  try {
    let patch: Record<string, unknown> = { ...parsed.data }
    try {
      const resolved = await resolveAdminImagePatch({
        bucket: "events",
        id,
        imageFile,
        imageValue: parsed.data.image,
        isMultipart,
        findExisting: findEventMediaState,
        uploadFile: uploadEventImage,
        uploadUrl: uploadEventImageFromUrl,
      })
      uploadedPath = resolved.uploadedPath
      previousImagePath = resolved.previousPath
      if (resolved.patch && Object.keys(resolved.patch).length > 0) {
        patch = { ...patch, ...resolved.patch }
      } else if (isMultipart && parsed.data.image !== undefined) {
        const candidate = parsed.data.image.trim()
        if (candidate.includes("/storage/v1/object/sign/") || candidate.includes("placeholder.local")) {
          const { image: _ignored, ...rest } = patch
          patch = rest as typeof rest
        }
      }
    } catch (uploadError) {
      const mapped = mapUploadErrorToResponse(uploadError)
      if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      const msg = uploadError instanceof Error ? uploadError.message : ""
      if (msg.includes("Sport event not found")) return NextResponse.json({ error: msg }, { status: 404 })
      return NextResponse.json({ error: "Image upload failed" }, { status: 502 })
    }
    const event = await updateEvent(id, patch, expectedUpdatedAt, user.id)
    if (previousImagePath && previousImagePath !== uploadedPath) {
      await deleteEventImage(previousImagePath).catch((error) => {
        log.warn("api.admin.events.previous_image_cleanup_failed", {
          id,
          path: previousImagePath,
          error: error instanceof Error ? error.message : error,
        })
      })
    }
    return setUpdatedAtHeaders(NextResponse.json(event), event.updatedAt)
  } catch (err) {
    if (uploadedPath) await deleteEventImage(uploadedPath).catch(() => undefined)
    return mapMutationErrorResponse(err, {
      serviceName: "events",
      notFoundPrefixes: ["Sport event not found"],
      logLabel: "api.admin.events.update_failed",
      log: log.error,
    })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requireCurationAccess(["content.write", "media.manage"])
  } catch (err) {
    return authorizationErrorResponse(err)
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  try {
    const existing = await findEventById(id)
    if (!existing) return NextResponse.json({ error: `Sport event not found: ${id}` }, { status: 404 })
    const existingCountry = (existing.location.countryCode as string | undefined) ?? ""
    const effectiveCountry = existingCountry || ""
    try { await requireEventCurationAccess(effectiveCountry, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
  } catch (err) {
    if (err instanceof TimeoutError || isConnectionError(err)) {
      return NextResponse.json({ error: "The events service is temporarily unavailable" }, { status: 503 })
    }
    const { AuthorizationError } = await import("@/lib/services/profile/authorization")
    if (err instanceof AuthorizationError) return authorizationErrorResponse(err)
    log.warn("api.admin.events.delete_scope_check_failed", { id, error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: "The events service is temporarily unavailable" }, { status: 503 })
  }

  try {
    const expectedUpdatedAt = getExpectedUpdatedAt(request)
    if (!expectedUpdatedAt) {
      return NextResponse.json(
        { error: "If-Match is required for deletes" },
        { status: 428 },
      )
    }
    const deleted = await deleteEvent(id, expectedUpdatedAt, user.id)
    if (deleted?.imagePath) {
      await deleteEventImage(deleted.imagePath).catch((error) => {
        log.warn("api.admin.events.deleted_image_cleanup_failed", {
          id,
          path: deleted.imagePath,
          error: error instanceof Error ? error.message : error,
        })
      })
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return mapMutationErrorResponse(err, {
      serviceName: "events",
      notFoundPrefixes: ["Sport event not found"],
      logLabel: "api.admin.events.delete_failed",
      log: log.error,
    })
  }
}
