import { NextResponse, type NextRequest } from "next/server"
import {
  leagueInvalidBody,
  leagueInvalidJson,
  leagueUnauthorized,
  privateNoCache,
} from "@/app/api/league/helpers"
import { getSessionUser } from "@/lib/auth/server"
import { leagueErrorResponse } from "../../league/errors"
import {
  getEmailDigestsEnabled,
  isEmailDeliveryAvailable,
  setEmailDigests,
} from "@/lib/notifications/service"
import { emailPreferencesInputSchema } from "@/lib/schemas/league"

/**
 * Email-digest preference for the signed-in user (default on) plus a
 * deliveryAvailable flag (feature detection): the UI hides the toggle
 * while Resend is unconfigured; the daily pg_cron sweep no-ops meanwhile.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  try {
    const [prefs, deliveryAvailable] = await Promise.all([
      getEmailDigestsEnabled(user.id),
      isEmailDeliveryAvailable(),
    ])
    return NextResponse.json(
      { emailDigests: prefs.emailDigests, deliveryAvailable },
      { headers: privateNoCache() },
    )
  } catch (error) {
    return leagueErrorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return leagueInvalidJson()
  }
  const parsed = emailPreferencesInputSchema.safeParse(body)
  if (!parsed.success) {
    return leagueInvalidBody(parsed.error)
  }
  try {
    return NextResponse.json(await setEmailDigests(user.id, parsed.data.emailDigests))
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
