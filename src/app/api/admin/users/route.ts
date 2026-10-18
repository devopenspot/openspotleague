import { NextResponse } from "next/server"
import { z } from "zod"
import { isConnectionError, TimeoutError } from "@/lib/db/client"
import {
  authorizationErrorResponse,
  requireAdministrator,
} from "@/lib/auth/server"
import { ROLE_SLUGS } from "@/lib/services/profile/authorization"
import { runListAdminUsers } from "@/lib/services/admin/admin-users"
import { decodeAdminUserCursor, encodeAdminUserCursor } from "@/lib/repositories/admin/admin-user-pagination"

const QuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLE_SLUGS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
}).strict()

export async function GET(request: Request) {
  try {
    await requireAdministrator()
  } catch (error) {
    return authorizationErrorResponse(error)
  }

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid user-list query", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const cursor = decodeAdminUserCursor(parsed.data.cursor)
  if (parsed.data.cursor && !cursor) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
  }

  try {
    const result = await runListAdminUsers({
      q: parsed.data.q,
      role: parsed.data.role,
      limit: parsed.data.limit,
      cursor,
    })
    return NextResponse.json({
      ...result,
      nextCursor: result.nextCursor
        ? encodeAdminUserCursor(result.nextCursor)
        : null,
    })
  } catch (error) {
    if (isConnectionError(error) || error instanceof TimeoutError) {
      return NextResponse.json(
        { error: "User directory is temporarily unavailable" },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: "Unable to load users" },
      { status: 500 },
    )
  }
}
