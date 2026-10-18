import { NextResponse, type NextRequest } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
  requireSpotCurationAccess,
} from "@/lib/auth/server"
import { SpotPatchSchema } from "@/lib/schemas/spot"
import {
  deleteSpot,
  findSpotMediaState,
  hideSpotCluster,
  runFindSpotById,
  updateSpot,
} from "@/lib/services/spot/spots"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { resolveScopeCountryCode } from "@/lib/services/country-scope"
import { mapMutationErrorResponse } from "@/lib/api/admin-handler"
import { isForeignKeyViolation } from "@/lib/repositories/core/db-error-map"
import { log } from "@/lib/utils/log"
import { deleteSpotImage, uploadSpotImage, uploadSpotImageFromUrl } from "@/lib/storage"
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
  let isMultipart = false
  let expectedUpdatedAt: string | undefined
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    isMultipart = true
    const form = await request.formData()
    expectedUpdatedAt = getExpectedUpdatedAt(request, form)
    const value = (key: string) => {
      const entry = form.get(key)
      return typeof entry === "string" ? entry : ""
    }
    const imageEntry = form.get("image")
    imageFile = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null
    body = {
      name: value("name") || undefined, city: value("city") || undefined,
      citySlug: value("citySlug") || undefined, address: value("address") || undefined,
      types: form.getAll("type").filter((entry): entry is string => typeof entry === "string"),
      sports: form.getAll("sports").filter((entry): entry is string => typeof entry === "string"),
      image: value("imageUrl") || undefined, country: value("country") || undefined,
      countryCode: value("countryCode").toUpperCase() || undefined,
      location: { lat: value("lat").trim() ? Number(value("lat")) : undefined, lon: value("lon").trim() ? Number(value("lon")) : undefined },
      instagram: value("instagram").trim() || null,
    }
  } else {
    expectedUpdatedAt = getExpectedUpdatedAt(request)
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
  }

  const parsed = SpotPatchSchema.safeParse(body)
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

  // Enforce scoped spot curation: need scope for existing country and for target country if changed.
  // Fail-closed: any DB/connectivity error surfaces as 503 instead of silently bypassing scope.
  try {
    const existingSpot = await runFindSpotById(id)
    if (!existingSpot) return NextResponse.json({ error: `Spot not found: ${id}` }, { status: 404 })
    const existingCountry = existingSpot.countryCode
    try { await requireSpotCurationAccess(existingCountry, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
    let targetCountry = existingCountry
    if (parsed.data.countryCode) targetCountry = parsed.data.countryCode.toUpperCase()
    else if (parsed.data.country) {
      try {
        targetCountry = await resolveScopeCountryCode({ country: parsed.data.country })
      } catch (err) {
        if (err instanceof TimeoutError || isConnectionError(err)) {
          return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
        }
        const msg = err instanceof Error ? err.message : "countryCode is required"
        const status = (err as { status?: number }).status ?? 400
        return NextResponse.json({ error: msg }, { status })
      }
    }
    if (targetCountry !== existingCountry) {
      try { await requireSpotCurationAccess(targetCountry, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
    }
  } catch (err) {
    if (err instanceof TimeoutError || isConnectionError(err)) {
      return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
    }
    // Only swallow non-retryable lookup misses; auth errors already returned above
    const msg = err instanceof Error ? err.message : ""
    if (msg.includes("Spot not found")) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    // Re-throw auth errors that bubbled due to missing inner catch
    const { AuthorizationError } = await import("@/lib/services/profile/authorization")
    if (err instanceof AuthorizationError) return authorizationErrorResponse(err)
    log.warn("api.admin.spots.scope_check_failed", { id, error: msg })
    return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
  }

  let uploadedPath: string | null = null
  let previousImagePath: string | null = null
  try {
    let patch: Record<string, unknown> = { ...parsed.data }
    // Unified R2-only image handling (file / URL / clear / signed echo)
    try {
      const resolved = await resolveAdminImagePatch({
        bucket: "spots",
        id,
        imageFile,
        imageValue: parsed.data.image,
        isMultipart,
        findExisting: findSpotMediaState,
        uploadFile: uploadSpotImage,
        uploadUrl: uploadSpotImageFromUrl,
      })
      uploadedPath = resolved.uploadedPath
      previousImagePath = resolved.previousPath
      // Merge resolved patch: empty means keep current, else override image/imagePath
      if (resolved.patch && Object.keys(resolved.patch).length > 0) {
        patch = { ...patch, ...resolved.patch }
      } else if (isMultipart && parsed.data.image !== undefined) {
        // Signed/placeholder echo — strip image key so we don't overwrite with placeholder
        const candidate = parsed.data.image.trim()
        if (candidate.includes("/storage/v1/object/sign/") || candidate.includes("placeholder.local")) {
          const { image: _ignored, ...rest } = patch
          patch = rest as typeof rest
        }
      }
    } catch (uploadError) {
      const mapped = mapUploadErrorToResponse(uploadError)
      if (mapped) return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      // Not found from findExisting
      const msg = uploadError instanceof Error ? uploadError.message : ""
      if (msg.includes("Spot not found")) return NextResponse.json({ error: msg }, { status: 404 })
      return NextResponse.json({ error: "Image upload failed" }, { status: 502 })
    }
    const spot = await updateSpot(id, patch, expectedUpdatedAt, user.id)
    if (previousImagePath && previousImagePath !== uploadedPath) {
      await deleteSpotImage(previousImagePath).catch((error) => {
        log.warn("api.admin.spots.previous_image_cleanup_failed", {
          id,
          path: previousImagePath,
          error: error instanceof Error ? error.message : error,
        })
      })
    }
    return setUpdatedAtHeaders(NextResponse.json(spot), spot.updatedAt)
  } catch (err) {
    if (uploadedPath) await deleteSpotImage(uploadedPath).catch(() => undefined)
    return mapMutationErrorResponse(err, {
      serviceName: "spots",
      notFoundPrefixes: ["Spot not found"],
      logLabel: "api.admin.spots.update_failed",
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
    const existingSpot = await runFindSpotById(id)
    if (!existingSpot) return NextResponse.json({ error: `Spot not found: ${id}` }, { status: 404 })
    try { await requireSpotCurationAccess(existingSpot.countryCode, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
  } catch (err) {
    if (err instanceof TimeoutError || isConnectionError(err)) {
      return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
    }
    const { AuthorizationError } = await import("@/lib/services/profile/authorization")
    if (err instanceof AuthorizationError) return authorizationErrorResponse(err)
    log.warn("api.admin.spots.delete_scope_check_failed", { id, error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
  }

  try {
    const expectedUpdatedAt = getExpectedUpdatedAt(request)
    if (!expectedUpdatedAt) {
      return NextResponse.json(
        { error: "If-Match is required for deletes" },
        { status: 428 },
      )
    }
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode")
    if (mode === "cluster") {
      const result = await hideSpotCluster(id, expectedUpdatedAt, user.id)
      return NextResponse.json({ hidden: true, mode: "cluster", ...result })
    }
    const deleted = await deleteSpot(id, expectedUpdatedAt, user.id)
    if (deleted?.imagePath) {
      await deleteSpotImage(deleted.imagePath).catch((error) => {
        log.warn("api.admin.spots.deleted_image_cleanup_failed", {
          id,
          path: deleted.imagePath,
          error: error instanceof Error ? error.message : error,
        })
      })
    }
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      // Tripwire for a future `RESTRICT → spots` FK that `detachSpotDependents`
      // does not handle yet: fail as a 409 with an actionable message instead
      // of a 500, and never echo the raw constraint detail.
      log.error(
        "api.admin.spots.delete_failed",
        err instanceof Error ? err.message : String(err),
      )
      return NextResponse.json(
        { error: "Cannot delete spot with associated games or history" },
        { status: 409 },
      )
    }
    return mapMutationErrorResponse(err, {
      serviceName: "spots",
      notFoundPrefixes: ["Spot not found"],
      logLabel: "api.admin.spots.delete_failed",
      log: log.error,
    })
  }
}

export async function POST(
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
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  let body: { action?: string; mode?: string }
  try {
    body = (await request.json()) as { action?: string; mode?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const expectedUpdatedAt = getExpectedUpdatedAt(request)
  if (!expectedUpdatedAt) {
    return NextResponse.json({ error: "If-Match is required" }, { status: 428 })
  }
  try {
    const existingSpot = await runFindSpotById(id)
    if (!existingSpot) return NextResponse.json({ error: `Spot not found: ${id}` }, { status: 404 })
    try { await requireSpotCurationAccess(existingSpot.countryCode, ["content.write", "media.manage"]) } catch (e) { return authorizationErrorResponse(e) }
  } catch (err) {
    if (err instanceof TimeoutError || isConnectionError(err)) {
      return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
    }
    const { AuthorizationError } = await import("@/lib/services/profile/authorization")
    if (err instanceof AuthorizationError) return authorizationErrorResponse(err)
    log.warn("api.admin.spots.moderate_scope_check_failed", { id, error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: "The spots service is temporarily unavailable" }, { status: 503 })
  }
  try {
    if (body?.action === "unhide") {
      const { unhideSpot } = await import("@/lib/services/spot/spots")
      await unhideSpot(id, expectedUpdatedAt, user.id)
      return NextResponse.json({ hidden: false, adminHidden: false })
    }
    if (body?.action === "hide_cluster" || body?.mode === "cluster") {
      const result = await hideSpotCluster(id, expectedUpdatedAt, user.id)
      return NextResponse.json({ hidden: true, mode: "cluster", ...result })
    }
    // default single hide
    const { hideSpot } = await import("@/lib/services/spot/spots")
    await hideSpot(id, expectedUpdatedAt, user.id)
    return NextResponse.json({ hidden: true, mode: "single", adminHidden: true })
  } catch (err) {
    return mapMutationErrorResponse(err, {
      serviceName: "spots",
      notFoundPrefixes: ["Spot not found"],
      logLabel: "api.admin.spots.moderate_failed",
      log: log.error,
    })
  }
}
