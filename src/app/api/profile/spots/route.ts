import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireUser } from "@/lib/auth/server"
import { listProfileSpots } from "@/lib/services/profile/profile"

const Query = z.object({
  kind: z.enum(["saved", "verified", "visited"]).default("saved"),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const url = new URL(request.url)
    const parsed = Query.safeParse({
      kind: url.searchParams.get("kind") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 })
    }
    const result = await listProfileSpots(user.id, parsed.data.kind, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    if (error instanceof Error && error.message === "Not signed in") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
