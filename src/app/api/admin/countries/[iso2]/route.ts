import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import { updateCountry, deleteCountry } from "@/lib/services/admin/admin-regions"
import { z } from "zod"
import { mapAdminDeleteError } from "@/lib/repositories/core/db-error-map"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"

const UpdateCountrySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  iso3: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().length(3).regex(/^[A-Za-z]{3}$/, "ISO3 must be three letters").nullable().optional(),
  ),
  regionId: z.string().uuid().optional(),
}).strict()

function normalizeIso3(iso3: string | null | undefined): string | null {
  if (!iso3) return null
  const trimmed = iso3.trim()
  return trimmed === "" ? null : trimmed.toUpperCase()
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ iso2: string }> },
) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }

  const { iso2 } = await context.params
  const parsed = UpdateCountrySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    auditWarn("audit.admin.countries.update_invalid", { requestId, actor, iso2, error: parsed.error.flatten() })
    return NextResponse.json(
      { error: "Invalid country", details: parsed.error.flatten() },
      { status: 400, headers: withRequestIdHeaders(requestId) },
    )
  }

  try {
    const data = { ...parsed.data, iso3: normalizeIso3(parsed.data.iso3) }
    const country = await updateCountry(iso2, data)
    auditInfo("audit.admin.countries.update", { requestId, actor, iso2, patch: data })
    return NextResponse.json(country, { headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapAdminDeleteError(error, "Country")
    auditWarn("audit.admin.countries.update_failed", { requestId, actor, iso2, status, error: message })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ iso2: string }> },
) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    const user = await requireAdministrator()
    actor = user.id
  } catch (error) {
    return authorizationErrorResponse(error)
  }

  const { iso2 } = await context.params
  try {
    await deleteCountry(iso2)
    auditInfo("audit.admin.countries.delete", { requestId, actor, iso2 })
    return new NextResponse(null, { status: 204, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapAdminDeleteError(error, "Country")
    auditWarn("audit.admin.countries.delete_failed", { requestId, actor, iso2, status, error: message })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}
