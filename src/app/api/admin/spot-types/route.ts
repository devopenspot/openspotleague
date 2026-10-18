import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireAdministrator,
  requireCurationAccess,
} from "@/lib/auth/server"
import { TaxonomyEntrySchema } from "@/lib/schemas/taxonomy"
import { createSpotType, listAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { isUniqueViolation } from "@/lib/repositories/core/db-error-map"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"

async function guard() {
  try {
    await requireCurationAccess("content.read")
    return null
  } catch (error) {
    return authorizationErrorResponse(error)
  }
}

export async function GET() {
  const denied = await guard(); if (denied) return denied
  return NextResponse.json((await listAdminTaxonomy()).spotTypes)
}

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  const parsed = TaxonomyEntrySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    auditWarn("audit.admin.spot_types.create_invalid", { requestId, actor, error: parsed.error.flatten() })
    return NextResponse.json({ error: "Invalid spot type", details: parsed.error.flatten() }, { status: 400, headers: withRequestIdHeaders(requestId) })
  }
  try {
    const result = await createSpotType(parsed.data)
    auditInfo("audit.admin.spot_types.create", { requestId, actor, slug: result.slug })
    return NextResponse.json(result, { status: 201, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    auditWarn("audit.admin.spot_types.create_failed", { requestId, actor, error: message })
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Spot type slug already exists" }, { status: 409, headers: withRequestIdHeaders(requestId) })
    }
    // Unknown failures: 500 with a generic body — never echo internals.
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: withRequestIdHeaders(requestId) })
  }
}
