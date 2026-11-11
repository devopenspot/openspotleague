/**
 * SQS FIFO → Resend (free plan). One record = one EmailJob (see the shared
 * contract). The batch loop lives in
 * `src/lib/notifications/delivery/sender-batch.ts` and the Resend request and
 * outcome rules in `resend-request.ts` (both unit-tested there); this file
 * wires them to SQS, SSM and DynamoDB.
 *
 * - Idempotent on `job.key` twice over: Powertools + DynamoDB (24 h TTL) here,
 *   and Resend's own `Idempotency-Key` (24 h). SQS is at-least-once and the
 *   Worker may re-enqueue a stale job, so the same key never sends twice.
 * - Permanent: only what is wrong with this one email (400/422). Reported
 *   `failed`, not retried.
 * - Quota (429 daily/monthly quota): reported `deferred` with the rest of the
 *   batch; the Worker closes today's budget. Never retried here, so a used-up
 *   free quota costs no further SQS or Lambda requests.
 * - Everything else retries, then lands in the DLQ and raises the alarm.
 *   That includes account-wide problems (revoked key, unverified domain):
 *   they must alert, not silently fail every email.
 * - Outcomes go back to the app in one signed report per batch.
 */

import { IdempotencyConfig, makeIdempotent } from "@aws-lambda-powertools/idempotency"
import { DynamoDBPersistenceLayer } from "@aws-lambda-powertools/idempotency/dynamodb"
import type { Context, SQSBatchResponse, SQSEvent } from "aws-lambda"
import type { EmailJob } from "../../../src/lib/notifications/delivery/contract"
import {
  buildResendRequest,
  classifyResendResponse,
  RESEND_EMAILS_URL,
} from "../../../src/lib/notifications/delivery/resend-request"
import {
  PermanentSendError,
  processEmailBatch,
  QuotaExceededError,
} from "../../../src/lib/notifications/delivery/sender-batch"
import { reportDelivery } from "./shared/app-client"
import { forgetParameter, requiredEnv, secureParameter } from "./shared/ssm"

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE ?? "",
})

const replyTo = process.env.REPLY_TO?.trim() || undefined

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function sendJob(job: EmailJob): Promise<{ messageId: string }> {
  const apiKey = await secureParameter("RESEND_API_KEY_PARAM")
  const response = await fetch(RESEND_EMAILS_URL, {
    ...buildResendRequest(job, { apiKey, from: requiredEnv("FROM_ADDRESS"), replyTo }),
    signal: AbortSignal.timeout(20_000),
  })
  const outcome = classifyResendResponse(response.status, await readBody(response))
  switch (outcome.kind) {
    case "sent":
      return { messageId: outcome.id }
    case "permanent":
      throw new PermanentSendError(outcome.reason)
    case "quota":
      throw new QuotaExceededError(outcome.reason)
    case "retry": {
      if (response.status === 401) forgetParameter("RESEND_API_KEY_PARAM") // rotated key
      const error = new Error(outcome.reason)
      error.name = "ResendRetry"
      throw error
    }
  }
}

const idempotency = new IdempotencyConfig({
  eventKeyJmesPath: "key",
  expiresAfterSeconds: 24 * 60 * 60,
})

const idempotentSend = makeIdempotent(sendJob, { persistenceStore, config: idempotency })

export async function handler(event: SQSEvent, context: Context): Promise<SQSBatchResponse> {
  idempotency.registerLambdaContext(context)
  const { failedMessageIds, reports } = await processEmailBatch(
    event.Records.map((record) => ({
      messageId: record.messageId,
      body: record.body,
      groupId: record.attributes.MessageGroupId ?? record.messageId,
    })),
    idempotentSend,
  )
  if (reports.length > 0) await reportDelivery(reports)
  return { batchItemFailures: failedMessageIds.map((itemIdentifier) => ({ itemIdentifier })) }
}
