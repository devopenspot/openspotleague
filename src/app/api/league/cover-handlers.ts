import { NextResponse, type NextRequest } from "next/server"
import { leagueInvalidBody, leagueInvalidJson } from "@/app/api/league/helpers"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { leagueMutationInputSchema } from "@/lib/schemas/league"
import {
  setContestCover,
  type CuratorActionOptions,
} from "@/lib/services/league"
import {
  deleteEventImage,
  UploadValidationError,
  uploadEventImage,
} from "@/lib/storage"
import { extractStoragePath } from "@/lib/storage/variants"
import { log } from "@/lib/utils/log"

/**
 * Contest cover handlers shared by the organizer route
 * (`/api/league/events/[id]/cover`) and the curator route
 * (`/api/admin/league/contests/[id]/cover`). Callers authenticate first;
 * `authorize` runs after validation and before the upload so rejected callers
 * never write to storage. Replaced, replayed and orphaned files are removed
 * best-effort.
 */

interface CoverContext {
  eventId: string
  actorId: string
  /** Throws a league or authorization error when the actor may not edit. */
  authorize?: () => Promise<void>
  options?: CuratorActionOptions
}

async function removeStoredCover(url: string | null): Promise<void> {
  const path = extractStoragePath(url)
  if (!path) return
  await deleteEventImage(path).catch((error: unknown) => {
    log.warn(
      "api.league.cover.cleanup_failed",
      error instanceof Error ? error.message : "cleanup failed",
    )
  })
}

export async function handleCoverUpload(
  request: NextRequest,
  context: CoverContext,
): Promise<NextResponse> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form body" }, { status: 400 })
  }
  const fileEntry = form.get("image")
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null
  if (!file) {
    return NextResponse.json({ error: "An image file is required" }, { status: 400 })
  }
  const parsed = leagueMutationInputSchema.safeParse({
    expectedVersion: Number(form.get("expectedVersion")),
    idempotencyKey: form.get("idempotencyKey"),
  })
  if (!parsed.success) return leagueInvalidBody(parsed.error)

  if (context.authorize) {
    try {
      await context.authorize()
    } catch (error) {
      return leagueErrorResponse(error)
    }
  }

  let uploadedUrl: string
  try {
    const uploaded = await uploadEventImage(file, context.eventId)
    uploadedUrl = uploaded.url
  } catch (error) {
    if (error instanceof UploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof TimeoutError || isConnectionError(error)) {
      return NextResponse.json(
        { error: "Storage is temporarily unavailable" },
        { status: 503 },
      )
    }
    log.error(
      "api.league.cover.upload_failed",
      error instanceof Error ? error.message : "Image upload failed",
    )
    return NextResponse.json({ error: "Image upload failed" }, { status: 502 })
  }

  try {
    const result = await setContestCover(
      context.actorId,
      {
        eventId: context.eventId,
        expectedVersion: parsed.data.expectedVersion,
        idempotencyKey: parsed.data.idempotencyKey,
        imageUrl: uploadedUrl,
      },
      context.options,
    )
    // A replay already stored an earlier upload; this file is surplus.
    await removeStoredCover(result.replayed ? uploadedUrl : result.previousImageUrl)
    return NextResponse.json({ id: result.id, version: result.version })
  } catch (error) {
    await removeStoredCover(uploadedUrl)
    return leagueErrorResponse(error)
  }
}

export async function handleCoverClear(
  request: NextRequest,
  context: CoverContext,
): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = leagueMutationInputSchema.safeParse(body)
  if (!parsed.success) return leagueInvalidBody(parsed.error)
  try {
    const result = await setContestCover(
      context.actorId,
      {
        eventId: context.eventId,
        expectedVersion: parsed.data.expectedVersion,
        idempotencyKey: parsed.data.idempotencyKey,
        imageUrl: null,
      },
      context.options,
    )
    await removeStoredCover(result.previousImageUrl)
    return NextResponse.json({ id: result.id, version: result.version })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
