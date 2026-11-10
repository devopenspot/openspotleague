/**
 * Signed calls from the Lambdas to the OpenSpot Worker
 * (`/api/internal/notifications/*`). The HMAC secret lives in SSM Parameter
 * Store as a SecureString (AWS-managed key, free tier) and is cached for the
 * life of the execution environment.
 */

import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm"
import { signedHeaders, type DeliveryReport } from "../../../../src/lib/notifications/delivery/contract"

const ssm = new SSMClient({})
let cachedSecret: string | null = null

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

async function internalSecret(): Promise<string> {
  if (cachedSecret) return cachedSecret
  const result = await ssm.send(
    new GetParameterCommand({ Name: required("INTERNAL_SECRET_PARAM"), WithDecryption: true }),
  )
  const value = result.Parameter?.Value
  if (!value) throw new Error("Internal secret parameter is empty")
  cachedSecret = value
  return value
}

export async function postToApp(path: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload)
  const url = new URL(path, required("APP_URL"))
  const response = await fetch(url, {
    method: "POST",
    headers: signedHeaders(await internalSecret(), url.pathname, body),
    body,
    signal: AbortSignal.timeout(25_000),
  })
  if (response.status === 401) cachedSecret = null // rotated: re-read next time
  return response
}

/**
 * Posts outcomes to the app. By default a failure only logs: a lost `sent`
 * report is recovered by the Worker's stale-queued backstop. Bounce and
 * complaint feedback has no such backstop, so that caller passes
 * `throwOnFailure` and lets Lambda retry the invocation.
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
