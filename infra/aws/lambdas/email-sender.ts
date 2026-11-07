/**
 * SQS FIFO → SES v2. One record = one EmailJob (see the shared contract).
 *
 * - Idempotent on `job.key` (Powertools + DynamoDB, 24 h TTL): SQS is
 *   at-least-once and the Worker may re-enqueue a stale job, so the same key
 *   never sends twice — a repeat returns the stored SES message id.
 * - FIFO partial failures: once a record fails, it and every later record
 *   are returned as failures so per-user order holds; already-sent ones are
 *   skipped on retry by the idempotency record.
 * - Permanent problems (bad payload, SES rejects the message) are reported
 *   `failed` and not retried; throttling and 5xx are retried, then the DLQ.
 * - Outcomes go back to the app in one signed report per batch.
 */

import { IdempotencyConfig, makeIdempotent } from "@aws-lambda-powertools/idempotency"
import { DynamoDBPersistenceLayer } from "@aws-lambda-powertools/idempotency/dynamodb"
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2"
import type { SQSBatchResponse, SQSEvent, SQSRecord } from "aws-lambda"
import { EmailJobSchema, type DeliveryReport, type EmailJob } from "../../../src/lib/notifications/delivery/contract"
import { reportDelivery } from "./shared/app-client"

const ses = new SESv2Client({})

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE ?? "",
})

const PERMANENT_SES_ERRORS = new Set([
  "MessageRejected",
  "BadRequestException",
  "NotFoundException",
  "AccountSuspendedException",
  "SendingPausedException",
  "MailFromDomainNotVerifiedException",
])

class PermanentError extends Error {}

async function sendJob(job: EmailJob): Promise<{ messageId: string }> {
  try {
    const result = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.FROM_ADDRESS,
        Destination: { ToAddresses: [job.to] },
        ConfigurationSetName: process.env.CONFIGURATION_SET,
        EmailTags: [{ Name: "category", Value: job.category }],
        Content: {
          Simple: {
            Subject: { Data: job.subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: job.html, Charset: "UTF-8" },
              Text: { Data: job.text, Charset: "UTF-8" },
            },
            Headers: [
              { Name: "List-Unsubscribe", Value: `<${job.unsubscribeUrl}>` },
              { Name: "List-Unsubscribe-Post", Value: "List-Unsubscribe=One-Click" },
            ],
          },
        },
      }),
    )
    return { messageId: result.MessageId ?? "" }
  } catch (error) {
    const name = (error as { name?: string }).name ?? ""
    if (PERMANENT_SES_ERRORS.has(name)) {
      throw new PermanentError(`${name}: ${(error as Error).message}`)
    }
    throw error
  }
}

const idempotentSend = makeIdempotent(sendJob, {
  persistenceStore,
  config: new IdempotencyConfig({
    eventKeyJmesPath: "key",
    expiresAfterSeconds: 24 * 60 * 60,
  }),
})

function parseRecord(record: SQSRecord): EmailJob | null {
  try {
    const parsed = EmailJobSchema.safeParse(JSON.parse(record.body))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const failures: string[] = []
  const reports: DeliveryReport["reports"] = []
  let halted = false

  for (const record of event.Records) {
    if (halted) {
      failures.push(record.messageId)
      continue
    }
    const job = parseRecord(record)
    if (!job) {
      // Unparseable: retrying cannot help. Ids are unknown, so log and drop.
      console.error("invalid email job", record.messageId)
      continue
    }
    try {
      const { messageId } = await idempotentSend(job)
      reports.push({ kind: "job", notificationIds: job.notificationIds, status: "sent", sesMessageId: messageId })
    } catch (error) {
      if (error instanceof PermanentError) {
        console.warn("email permanently failed", job.key, error.message)
        reports.push({
          kind: "job",
          notificationIds: job.notificationIds,
          status: "failed",
          reason: error.message.slice(0, 500),
        })
        continue
      }
      console.warn("email send will retry", job.key, error instanceof Error ? error.message : error)
      failures.push(record.messageId)
      halted = true
    }
  }

  if (reports.length > 0) await reportDelivery(reports)
  return { batchItemFailures: failures.map((itemIdentifier) => ({ itemIdentifier })) }
}
