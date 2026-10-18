import { NextResponse } from "next/server"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import { createCountry, listAdminCountries } from "@/lib/services/admin/admin-regions"
import { z } from "zod"
import { mapCountryCreateError } from "@/lib/repositories/core/db-error-map"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"

const CreateCountrySchema = z.object({
  iso2: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "ISO2 must be two letters"),
  name: z.string().trim().min(1).max(100),
  iso3: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().length(3).regex(/^[A-Za-z]{3}$/, "ISO3 must be three letters").nullable().optional(),
  ),
  regionId: z.string().uuid(),
}).strict()

function normalizeIso2(value: string): string {
  return value.trim().toUpperCase()
}

function normalizeIso3(value: string | null | undefined): string | null {
  if (value == null) return null
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed.toUpperCase()
}

export async function GET() {
  try {
    await requireAdministrator()
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  return NextResponse.json({ items: await listAdminCountries() })
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

  const parsed = CreateCountrySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    auditWarn("audit.admin.countries.create_invalid", { requestId, actor, error: parsed.error.flatten() })
    return NextResponse.json(
      { error: "Invalid country", details: parsed.error.flatten() },
      { status: 400, headers: withRequestIdHeaders(requestId) },
    )
  }

  try {
    const country = await createCountry({
      iso2: normalizeIso2(parsed.data.iso2),
      name: parsed.data.name.trim(),
      iso3: normalizeIso3(parsed.data.iso3),
      regionId: parsed.data.regionId,
    })
    auditInfo("audit.admin.countries.create", { requestId, actor, iso2: country.iso2, regionId: country.regionId })
    return NextResponse.json(country, { status: 201, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    const { status, message } = mapCountryCreateError(error)
    auditWarn("audit.admin.countries.create_failed", { requestId, actor, iso2: parsed.data.iso2, status, error: message })
    return NextResponse.json({ error: message }, { status, headers: withRequestIdHeaders(requestId) })
  }
}
