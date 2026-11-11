/**
 * Signed calls from the Lambdas to the OpenSpot Worker
 * (`/api/internal/notifications/*`). The HMAC secret is the SSM SecureString
 * named by `INTERNAL_SECRET_PARAM`, cached by `./ssm`.
 */

import { signedHeaders, type DeliveryReport } from "../../../../src/lib/notifications/delivery/contract"
import { forgetParameter, requiredEnv, secureParameter } from "./ssm"

export async function postToApp(path: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload)
  const url = new URL(path, requiredEnv("APP_URL"))
  const response = await fetch(url, {
    method: "POST",
    headers: signedHeaders(await secureParameter("INTERNAL_SECRET_PARAM"), url.pathname, body),
    body,
    signal: AbortSignal.timeout(25_000),
  })
  if (response.status === 401) forgetParameter("INTERNAL_SECRET_PARAM") // rotated: re-read next time
  return response
}

/**
 * Posts outcomes to the app. By default a failure only logs: a lost `sent`
 * report is recovered by the Worker's stale-queued backstop. Bounce and
 * complaint feedback has no such backstop, so that caller passes
 * `throwOnFailure` and lets the webhook be retried.
 */
export async function reportDelivery(
  reports: DeliveryReport["reports"],
  options: { throwOnFailure?: boolean } = {},
): Promise<void> {
  for (let index = 0; index < reports.length; index += 100) {
    const chunk = reports.slice(index, index + 100)
    let failure: string | null = null
    try {
      const response = await postToApp("/api/internal/notifications/delivery", { reports: chunk })
      if (!response.ok) failure = `rejected ${response.status}`
    } catch (error) {
      failure = error instanceof Error ? error.name : "UnknownError"
    }
    if (!failure) continue
    console.warn("delivery report failed", failure)
    if (options.throwOnFailure) throw new Error(`delivery report failed: ${failure}`)
  }
}
