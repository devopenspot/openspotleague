import { NextResponse, type NextRequest } from "next/server"
import { getSessionUser } from "@/lib/auth/server"
import { listNotifications } from "@/lib/notifications/service"
import { leagueErrorResponse } from "@/app/api/league/errors"

export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    )
  }
  try {
    const params = request.nextUrl.searchParams
    const limitRaw = params.get("limit")
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined
    const before = params.get("before") ?? undefined
    const unreadOnly = params.get("unread") === "1"
    const result = await listNotifications(user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      unreadOnly,
      before,
    })
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-cache" },
    })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
