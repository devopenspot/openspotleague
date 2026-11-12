import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizationErrorResponse, requireAdministrator } from "@/lib/auth/server"
import { auditInfo, auditWarn, getRequestId, withRequestIdHeaders } from "@/lib/admin/audit"
import { FLAG_KEY_PATTERN } from "@/lib/flags/definition"
import {
  FeatureFlagError,
  clearFlagOverride,
  setFlagOverride,
} from "@/lib/services/flags/feature-flags"

// Overrides apply to this environment's database only (docs/feature-flags.md).
const OverrideSchema = z.object({
  enabled: z.boolean(),
  rolloutPercent: z.number().int().min(0).max(100),
  allowUserIds: z.array(z.string().uuid()).max(200).default([]),
  allowRoles: z.array(z.string().min(1).max(64)).max(20).default([]),
})

async function flagKey(context: { params: Promise<{ key: string }> }): Promise<string | null> {
  const { key } = await context.params
  return FLAG_KEY_PATTERN.test(key) ? key : null
}

export async function PUT(request: Request, context: { params: Promise<{ key: string }> }) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    actor = (await requireAdministrator()).id
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  const key = await flagKey(context)
  const parsed = OverrideSchema.safeParse(await request.json().catch(() => null))
  if (!key || !parsed.success) {
    auditWarn("audit.admin.flags.update_invalid", { requestId, actor, key })
    return NextResponse.json(
      { error: "Invalid flag override", details: parsed.success ? undefined : parsed.error.flatten() },
      { status: 400, headers: withRequestIdHeaders(requestId) },
    )
  }
  try {
    const saved = await setFlagOverride(key, parsed.data, actor)
    auditInfo("audit.admin.flags.update", { requestId, actor, key, enabled: saved.enabled, rolloutPercent: saved.rolloutPercent })
    return NextResponse.json(
      { key: saved.key, enabled: saved.enabled, rolloutPercent: saved.rolloutPercent, updatedAt: saved.updatedAt.toISOString() },
      { headers: withRequestIdHeaders(requestId) },
    )
  } catch (error) {
    if (error instanceof FeatureFlagError) {
      const status = error.code === "UNKNOWN_FLAG" ? 404 : 400
      return NextResponse.json({ error: error.message }, { status, headers: withRequestIdHeaders(requestId) })
    }
    auditWarn("audit.admin.flags.update_failed", { requestId, actor, key, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "Could not save the flag" }, { status: 500, headers: withRequestIdHeaders(requestId) })
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ key: string }> }) {
  const requestId = getRequestId(request)
  let actor!: string
  try {
    actor = (await requireAdministrator()).id
  } catch (error) {
    return authorizationErrorResponse(error)
  }
  const key = await flagKey(context)
  if (!key) return NextResponse.json({ error: "Invalid flag key" }, { status: 400, headers: withRequestIdHeaders(requestId) })
  try {
    await clearFlagOverride(key)
    auditInfo("audit.admin.flags.clear", { requestId, actor, key })
    return new NextResponse(null, { status: 204, headers: withRequestIdHeaders(requestId) })
  } catch (error) {
    auditWarn("audit.admin.flags.clear_failed", { requestId, actor, key, error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: "Could not clear the flag" }, { status: 500, headers: withRequestIdHeaders(requestId) })
  }
}
