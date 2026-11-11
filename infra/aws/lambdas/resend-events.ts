/**
 * Resend webhook (Lambda Function URL) → suppression in the app.
 * The Function URL is on AWS, so Cloudflare's Bot Fight Mode on the app's
 * custom domain never sees Resend's requests. The signature check and the
 * event mapping live in `src/lib/notifications/delivery/webhook-signature.ts`
 * (unit-tested there).
 *
 * Responses: 401 for a bad signature (Resend shows it as failed), 500 when the
 * app could not take the report (Resend retries with backoff), 200 otherwise.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda"
import {
  resendEventToReports,
  verifyResendWebhook,
} from "../../../src/lib/notifications/delivery/webhook-signature"
import { reportDelivery } from "./shared/app-client"
import { secureParameter } from "./shared/ssm"

function reply(statusCode: number, body: string): APIGatewayProxyStructuredResultV2 {
  return { statusCode, body, headers: { "content-type": "text/plain" } }
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  if (event.requestContext.http.method !== "POST") return reply(405, "method not allowed")
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : (event.body ?? "")
  const check = verifyResendWebhook({
    secret: await secureParameter("WEBHOOK_SECRET_PARAM"),
    body,
    id: event.headers["svix-id"],
    timestamp: event.headers["svix-timestamp"],
    signature: event.headers["svix-signature"],
  })
  if (check !== "ok") {
    console.warn("rejected webhook", check)
    return reply(401, check)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return reply(400, "invalid json")
  }
  const reports = resendEventToReports(parsed as Parameters<typeof resendEventToReports>[0])
  if (reports.length === 0) return reply(200, "ignored")
  try {
    await reportDelivery(reports, { throwOnFailure: true })
  } catch {
    return reply(500, "report failed")
  }
  return reply(200, "ok")
}
