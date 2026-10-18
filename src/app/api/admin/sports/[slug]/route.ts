import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import { TaxonomyPatchSchema } from "@/lib/schemas/taxonomy"
import { deleteSport, updateSport } from "@/lib/services/taxonomy/taxonomy"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"
import { mapAdminDeleteError } from "@/lib/repositories/core/db-error-map"

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  const parsed = TaxonomyPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    auditWarn("audit.admin.sports.update_invalid", { requestId, actor, error: parsed.error.flatten() })
    return NextResponse.json({ error: "Invalid sport", details: parsed.error.flatten() }, { status: 400, headers: withRequestIdHeaders(requestId) })
  }
  try {
    const slug = (await context.params).slug
    const result = await updateSport(slug, parsed.data)
    auditInfo("audit.admin.sports.update", { requestId, actor, slug, patch: parsed.data })
    return NextResponse.json(result, { headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapAdminDeleteError(error, "Sport")
    auditWarn("audit.admin.sports.update_failed", { requestId, actor, error: message, status })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ slug: string }> }) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  try {
    const slug = (await context.params).slug
    await deleteSport(slug)
    auditInfo("audit.admin.sports.delete", { requestId, actor, slug })
    return new NextResponse(null, { status: 204, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapAdminDeleteError(error, "Sport")
    auditWarn("audit.admin.sports.delete_failed", { requestId, actor, error: message, status })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}
