import { NextResponse, type NextRequest } from "next/server"
import {
  leagueInvalidBody,
  leagueInvalidJson,
  leagueUnauthorized,
} from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { leagueMutationInputSchema } from "@/lib/schemas/league"
import { assertCanEditContest, setContestCover } from "@/lib/services/league"
import {
  deleteEventImage,
  UploadValidationError,
  uploadEventImage,
} from "@/lib/storage"
import { extractStoragePath } from "@/lib/storage/variants"
import { log } from "@/lib/utils/log"
import { leagueErrorResponse } from "../../../errors"
import { enforceLeagueRateLimit } from "../../../rate-limit"

/**
 * Contest cover (organizers, `config.edit`). POST takes multipart
 * `{ image, expectedVersion, idempotencyKey }`: the file is stored in the R2
 * events bucket first, then `setContestCover` swaps `image_url` in a
 * versioned transaction. DELETE takes JSON `{ expectedVersion,
 * idempotencyKey }` and falls back to the designed cover. Replaced or orphaned
 * files are removed best-effort.
 */

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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
  try {
    enforceLeagueRateLimit(request, user.id)
  } catch (error) {
    return leagueErrorResponse(error)
  }

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

  try {
    await assertCanEditContest(id, user.id)
  } catch (error) {
    return leagueErrorResponse(error)
  }

  let uploadedUrl: string
  try {
    const uploaded = await uploadEventImage(file, id)
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
    const result = await setContestCover(user.id, {
      eventId: id,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      imageUrl: uploadedUrl,
    })
    // A replay already stored an earlier upload; this file is surplus.
    await removeStoredCover(result.replayed ? uploadedUrl : result.previousImageUrl)
    return NextResponse.json({ id: result.id, version: result.version })
  } catch (error) {
    await removeStoredCover(uploadedUrl)
    return leagueErrorResponse(error)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const { id } = await context.params
  try {
    enforceLeagueRateLimit(request, user.id)
  } catch (error) {
    return leagueErrorResponse(error)
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = leagueMutationInputSchema.safeParse(body)
  if (!parsed.success) return leagueInvalidBody(parsed.error)
  try {
    const result = await setContestCover(user.id, {
      eventId: id,
      expectedVersion: parsed.data.expectedVersion,
      idempotencyKey: parsed.data.idempotencyKey,
      imageUrl: null,
    })
    await removeStoredCover(result.previousImageUrl)
    return NextResponse.json({ id: result.id, version: result.version })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
