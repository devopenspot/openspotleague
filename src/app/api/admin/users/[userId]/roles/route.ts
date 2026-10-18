import { NextResponse } from "next/server"
import { z } from "zod"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import {
  isAuthorizationError,
  ROLE_SLUGS,
} from "@/lib/services/profile/authorization"
import { listUserRoles, replaceUserRoles } from "@/lib/services/admin/admin-roles"
import { isInvalidReferenceError } from "@/lib/repositories/core/errors"

const RolesBodySchema = z.object({
  roles: z.array(z.enum(ROLE_SLUGS)).max(ROLE_SLUGS.length),
}).strict()

function guardError(error: unknown): NextResponse {
  return authorizationErrorResponse(error)
}

function mutationError(error: unknown): NextResponse {
  if (isConnectionError(error) || error instanceof TimeoutError) {
    return NextResponse.json(
      { error: "Role management is temporarily unavailable" },
      { status: 503 },
    )
  }
  const message = error instanceof Error ? error.message : "Internal error"
  if (message.startsWith("User not found")) {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  if (isInvalidReferenceError(error)) {
    return NextResponse.json({ error: message }, { status: 400 })
  }
  if (message === "The system must retain at least one administrator") {
    return NextResponse.json({ error: message }, { status: 409 })
  }
  if (isAuthorizationError(error)) {
    return authorizationErrorResponse(error)
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await requireAdministrator()
  } catch (error) {
    return guardError(error)
  }

  const { userId } = await context.params
  try {
    return NextResponse.json(await listUserRoles(userId))
  } catch (error) {
    return mutationError(error)
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  let admin
  try {
    admin = await requireAdministrator()
  } catch (error) {
    return guardError(error)
  }

  const parsed = RolesBodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid roles", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { userId } = await context.params
  try {
    return NextResponse.json(
      await replaceUserRoles(userId, parsed.data.roles, admin.id),
    )
  } catch (error) {
    return mutationError(error)
  }
}
