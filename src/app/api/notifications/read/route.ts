import { NextResponse, type NextRequest } from "next/server"
import { getSessionUser } from "@/lib/auth/server"
import { enforceLeagueRateLimit } from "@/app/api/league/rate-limit"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { markNotificationsRead } from "@/lib/notifications/service"
import { notificationReadInputSchema } from "@/lib/schemas/league"

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    )
  }
  try {
    enforceLeagueRateLimit(request, user.id)
  } catch (error) {
    return leagueErrorResponse(error)
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = notificationReadInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  try {
    const result = await markNotificationsRead(user.id, {
      ids: parsed.data.ids,
      all: parsed.data.all,
    })
    return NextResponse.json(result)
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
