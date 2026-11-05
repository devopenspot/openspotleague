import { NextResponse, type NextRequest } from "next/server"
import { getSessionUser } from "@/lib/auth/server"
import { leagueUnauthorized } from "@/app/api/league/helpers"
import { leagueErrorResponse } from "@/app/api/league/errors"
import { listLeagueRanking } from "@/lib/services/league/standings"
import { leagueRankingQuerySchema } from "@/lib/schemas/league"

/** Global League ranking (signed-in, like /api/ranking), filterable. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const parsed = leagueRankingQuerySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 })
  }
  try {
    const rows = await listLeagueRanking(parsed.data)
    return NextResponse.json({ rows })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
