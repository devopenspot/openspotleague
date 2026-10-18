import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import { updateRegion, deleteRegion } from "@/lib/services/admin/admin-regions"
import { z } from "zod"
import { mapAdminDeleteError } from "@/lib/repositories/core/db-error-map"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"

const UpdateRegionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict()

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }

  const { id } = await context.params
  const parsed = UpdateRegionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    auditWarn("audit.admin.regions.update_invalid", { requestId, actor, id, error: parsed.error.flatten() })
    return NextResponse.json(
      { error: "Invalid region", details: parsed.error.flatten() },
      { status: 400, headers: withRequestIdHeaders(requestId) },
    )
  }

  try {
    const region = await updateRegion(id, parsed.data)
    auditInfo("audit.admin.regions.update", { requestId, actor, id, patch: parsed.data })
    return NextResponse.json(region, { headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapAdminDeleteError(error, "Region")
    auditWarn("audit.admin.regions.update_failed", { requestId, actor, id, status, error: message })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }

  const { id } = await context.params
  try {
    await deleteRegion(id)
    auditInfo("audit.admin.regions.delete", { requestId, actor, id })
    return new NextResponse(null, { status: 204, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapAdminDeleteError(error, "Region")
    auditWarn("audit.admin.regions.delete_failed", { requestId, actor, id, status, error: message })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}
