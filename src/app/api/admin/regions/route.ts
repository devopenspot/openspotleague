import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import { listAdminRegions, createRegion } from "@/lib/services/admin/admin-regions"
import { z } from "zod"
import { isUniqueViolation } from "@/lib/repositories/core/db-error-map"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"

const CreateRegionSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict()

export async function GET() {
  try {
    await requireAdministrator()
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  return NextResponse.json({ items: await listAdminRegions() })
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

  const parsed = CreateRegionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    auditWarn("audit.admin.regions.create_invalid", { requestId, actor, error: parsed.error.flatten() })
    return NextResponse.json(
      { error: "Invalid region", details: parsed.error.flatten() },
      { status: 400, headers: withRequestIdHeaders(requestId) },
    )
  }

  try {
    const region = await createRegion(parsed.data)
    auditInfo("audit.admin.regions.create", { requestId, actor, id: region.id, slug: region.slug })
    return NextResponse.json(region, { status: 201, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    auditWarn("audit.admin.regions.create_failed", { requestId, actor, slug: parsed.data.slug, error: message })
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: "Region slug already exists" }, { status: 409, headers: withRequestIdHeaders(requestId) })
    }
    if (message.toLowerCase().includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404, headers: withRequestIdHeaders(requestId) })
    }
    // Unknown failures: 500 with a generic body — never echo internals or
    // mask genuine server faults as conflicts.
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: withRequestIdHeaders(requestId) })
  }
}
