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
  getEmailPreferences,
  isEmailDeliveryAvailable,
  setEmailPreferences,
} from "@/lib/notifications/service"
import { emailPreferencesInputSchema } from "@/lib/schemas/league"

/**
 * Per-category email preferences for the signed-in user (default on) plus a
 * deliveryAvailable flag (feature detection): the UI hides the toggles while
 * the AWS delivery env is unset (docs/notifications.md).
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) return leagueUnauthorized()
  try {
    const [preferences, deliveryAvailable] = await Promise.all([
      getEmailPreferences(user.id),
      isEmailDeliveryAvailable(),
    ])
    return NextResponse.json(
      { preferences, deliveryAvailable },
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
    return NextResponse.json(
      { preferences: await setEmailPreferences(user.id, parsed.data) },
      { headers: privateNoCache() },
    )
  } catch (error) {
    return leagueErrorResponse(error)
  }
}
