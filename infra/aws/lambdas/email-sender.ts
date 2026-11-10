/**
 * SQS FIFO → SES v2. One record = one EmailJob (see the shared contract).
 * The batch loop lives in `src/lib/notifications/delivery/sender-batch.ts`
 * (unit-tested there); this file wires it to SES and DynamoDB.
 *
 * - Idempotent on `job.key` (Powertools + DynamoDB, 24 h TTL): SQS is
 *   at-least-once and the Worker may re-enqueue a stale job, so the same key
 *   never sends twice — a repeat returns the stored SES message id. The
 *   Lambda context is registered so a timeout mid-send does not leave a
 *   record that blocks the retry.
 * - Permanent: only what is wrong with this one email (`MessageRejected`,
 *   `BadRequestException`). Those are reported `failed` and not retried.
 * - Everything else retries, then lands in the DLQ and raises the alarm.
 *   That includes account-wide problems (sending paused, account suspended,
 *   MAIL FROM not verified): they must alert, not silently fail every email.
 * - Outcomes go back to the app in one signed report per batch.
 */

import { IdempotencyConfig, makeIdempotent } from "@aws-lambda-powertools/idempotency"
import { DynamoDBPersistenceLayer } from "@aws-lambda-powertools/idempotency/dynamodb"
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2"
import type { Context, SQSBatchResponse, SQSEvent } from "aws-lambda"
import type { EmailJob } from "../../../src/lib/notifications/delivery/contract"
import { PermanentSendError, processEmailBatch } from "../../../src/lib/notifications/delivery/sender-batch"
import { reportDelivery } from "./shared/app-client"

const ses = new SESv2Client({})

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: process.env.IDEMPOTENCY_TABLE ?? "",
})

const PERMANENT_SES_ERRORS = new Set(["MessageRejected", "BadRequestException"])

const replyTo = process.env.REPLY_TO?.trim()

async function sendJob(job: EmailJob): Promise<{ messageId: string }> {
  try {
    const result = await ses.send(
      new SendEmailCommand({
        FromEmailAddress: process.env.FROM_ADDRESS,
        Destination: { ToAddresses: [job.to] },
        ...(replyTo ? { ReplyToAddresses: [replyTo] } : {}),
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
    // The name only: the SES message can contain the recipient address.
    if (PERMANENT_SES_ERRORS.has(name)) throw new PermanentSendError(name)
    throw error
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
