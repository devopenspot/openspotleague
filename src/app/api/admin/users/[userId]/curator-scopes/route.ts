import { NextResponse } from "next/server"
import { z } from "zod"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { authorizationErrorResponse, requireAdministrator } from "@/lib/auth/server"
import { isAuthorizationError } from "@/lib/services/profile/authorization"
import { listCuratorScopes, replaceCuratorScopes } from "@/lib/services/admin/curator-scopes"
import { isInvalidReferenceError } from "@/lib/repositories/core/errors"

const ScopesBodySchema = z.object({
  countryCodes: z.array(z.string().regex(/^[A-Za-z]{2}$/)).default([]),
  disciplineSlugs: z.array(z.string().min(1)).default([]),
}).strict()

function guardError(error: unknown): NextResponse {
  return authorizationErrorResponse(error)
}

function mutationError(error: unknown): NextResponse {
  if (isConnectionError(error) || error instanceof TimeoutError) {
    return NextResponse.json({ error: "Scope management is temporarily unavailable" }, { status: 503 })
  }
  const message = error instanceof Error ? error.message : "Internal error"
  if (message.startsWith("User not found")) return NextResponse.json({ error: message }, { status: 404 })
  if (isInvalidReferenceError(error)) return NextResponse.json({ error: message }, { status: 400 })
  if (isAuthorizationError(error)) return authorizationErrorResponse(error)
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}

export async function GET(_request: Request, context: { params: Promise<{ userId: string }> }) {
  try { await requireAdministrator() } catch (e) { return guardError(e) }
  const { userId } = await context.params
  try { return NextResponse.json(await listCuratorScopes(userId)) } catch (e) { return mutationError(e) }
}

export async function PUT(request: Request, context: { params: Promise<{ userId: string }> }) {
  let admin
  try { admin = await requireAdministrator() } catch (e) { return guardError(e) }
  const parsed = ScopesBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scopes", details: parsed.error.flatten() }, { status: 400 })
  }
  const { userId } = await context.params
  try {
    return NextResponse.json(await replaceCuratorScopes(userId, parsed.data, admin.id))
  } catch (e) { return mutationError(e) }
}
