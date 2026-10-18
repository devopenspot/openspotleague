import { NextResponse, type NextRequest } from "next/server"
import { getInvitePreview } from "@/lib/services/league"
import { leagueErrorResponse } from "../../errors"

/**
 * Public invite preview (unauthenticated-safe): event summary + invited role
 * + usability. The join itself requires a signed-in session (POST
 * /api/league/join).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params
  try {
    const preview = await getInvitePreview(code)
    if (!preview) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }
    return NextResponse.json(preview, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
