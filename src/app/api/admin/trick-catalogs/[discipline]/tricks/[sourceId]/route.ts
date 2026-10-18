import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireCurationAccess,
  requireTrickCurationAccess,
} from "@/lib/auth/server"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { log } from "@/lib/utils/log"
import { disciplineSlugSchema } from "@/lib/schemas/game"
import { TrickCatalogEntrySchema } from "@/lib/schemas/taxonomy"
import {
  deleteTrick,
  runListCurrentTrickCatalogs,
  saveTrick,
} from "@/lib/services/taxonomy/trick-catalogs"
import { getExpectedUpdatedAt, setUpdatedAtHeaders } from "@/lib/admin/concurrency"
import {
  isInvalidConcurrencyTokenError,
  isInvalidReferenceError,
  isStaleRecordError,
} from "@/lib/repositories/core/errors"
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from "@/lib/repositories/core/db-error-map"

async function guard(discipline?: string) {
  try {
    if (discipline) return await requireTrickCurationAccess(discipline, "taxonomy.use")
    return await requireCurationAccess("taxonomy.use")
  } catch (error) {
    return authorizationErrorResponse(error)
  }
}

function errorResponse(
  error: unknown,
  context: { discipline: string; sourceId: string; operation: string },
) {
  const message = error instanceof Error ? error.message : "Internal error"
  if (message.includes("not found")) {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  if (message.includes("at least one trick")) {
    return NextResponse.json({ error: message }, { status: 409 })
  }
  if (isInvalidConcurrencyTokenError(error)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (isStaleRecordError(error)) {
    return NextResponse.json({ error: message }, { status: 409 })
  }
  if (isInvalidReferenceError(error)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (isForeignKeyViolation(error)) {
    return NextResponse.json({ error: "Invalid spot type — value does not exist" }, { status: 400 })
  }
  if (isUniqueViolation(error)) {
    return NextResponse.json({ error: message }, { status: 409 })
  }
  if (error instanceof TimeoutError || isConnectionError(error)) {
    log.warn("api.admin.trick_catalog.unavailable", { ...context, message })
    return NextResponse.json(
      { error: "The trick catalog is temporarily unavailable" },
      { status: 503 },
    )
  }
  log.error("api.admin.trick_catalog.failed", { ...context, message })
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ discipline: string; sourceId: string }> },
) {
  const { discipline, sourceId } = await context.params
  if (!disciplineSlugSchema.safeParse(discipline).success) {
    return NextResponse.json({ error: "Unsupported discipline" }, { status: 400 })
  }
  const userOrDenied = await guard(discipline)
  if (userOrDenied instanceof Response) return userOrDenied
  const user = userOrDenied

  const parsed = TrickCatalogEntrySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid trick", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  if (parsed.data.sourceId !== sourceId) {
    return NextResponse.json({ error: "Trick source id does not match the route" }, { status: 400 })
  }
  const expectedUpdatedAt = getExpectedUpdatedAt(request)
  if (!expectedUpdatedAt) {
    return NextResponse.json(
      { error: "If-Match is required for trick edits" },
      { status: 428 },
    )
  }

  try {
    const saved = await saveTrick(discipline, parsed.data, {
      expectedUpdatedAt,
      actorId: user.id,
    })
    const catalog = (await runListCurrentTrickCatalogs()).find(
      (entry) => entry.disciplineSlug === discipline,
    )
    const body = catalog?.updatedAt ? { ...saved, updatedAt: catalog.updatedAt } : saved
    const response = NextResponse.json(body)
    if (catalog?.updatedAt) setUpdatedAtHeaders(response, catalog.updatedAt)
    return response
  } catch (error) {
    return errorResponse(error, { discipline, sourceId, operation: "save" })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ discipline: string; sourceId: string }> },
) {
  const { discipline, sourceId } = await context.params
  if (!disciplineSlugSchema.safeParse(discipline).success) {
    return NextResponse.json({ error: "Unsupported discipline" }, { status: 400 })
  }
  const userOrDenied = await guard(discipline)
  if (userOrDenied instanceof Response) return userOrDenied
  const user = userOrDenied

  const expectedUpdatedAt = getExpectedUpdatedAt(_request)
  if (!expectedUpdatedAt) {
    return NextResponse.json(
      { error: "If-Match is required for trick deletes" },
      { status: 428 },
    )
  }
  try {
    await deleteTrick(discipline, sourceId, {
      expectedUpdatedAt,
      actorId: user.id,
    })
    const catalog = (await runListCurrentTrickCatalogs()).find(
      (entry) => entry.disciplineSlug === discipline,
    )
    const response = new NextResponse(null, { status: 204 })
    if (catalog?.updatedAt) setUpdatedAtHeaders(response, catalog.updatedAt)
    return response
  } catch (error) {
    return errorResponse(error, { discipline, sourceId, operation: "delete" })
  }
}
