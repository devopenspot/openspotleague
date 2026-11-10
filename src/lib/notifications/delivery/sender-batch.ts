/**
 * The email sender Lambda's batch loop, kept free of AWS imports so it is
 * unit-tested here. Like `contract.ts` it is imported by `infra/aws` by
 * relative path: no `@/` aliases.
 *
 * One SQS FIFO record is one `EmailJob`. Per record:
 *   - unparseable                → logged and dropped (a retry cannot fix it)
 *   - sent                       → reported `sent`
 *   - `PermanentSendError`       → reported `failed`, not retried
 *   - any other error            → returned to SQS for a retry
 * A retry stops the rest of that record's message group only, so one user's
 * emails stay in order and a failure never spends other users' retries.
 */

import { EmailJobSchema, type DeliveryReport, type EmailJob } from "./contract"

export interface BatchRecord {
  messageId: string
  body: string
  /** SQS `MessageGroupId` (the recipient's user id). */
  groupId: string
}

/** Thrown by `send` for a problem with this one email that a retry cannot fix. */
export class PermanentSendError extends Error {}

export interface BatchOutcome {
  /** Message ids SQS must deliver again. */
  failedMessageIds: string[]
  reports: DeliveryReport["reports"]
}

type Logger = Pick<Console, "warn" | "error">

function parseJob(body: string): EmailJob | null {
  try {
    const parsed = EmailJobSchema.safeParse(JSON.parse(body))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError"
}

export async function processEmailBatch(
  records: readonly BatchRecord[],
  send: (job: EmailJob) => Promise<{ messageId: string }>,
  logger: Logger = console,
): Promise<BatchOutcome> {
  const failedMessageIds: string[] = []
  const reports: DeliveryReport["reports"] = []
  const haltedGroups = new Set<string>()

  for (const record of records) {
    if (haltedGroups.has(record.groupId)) {
      failedMessageIds.push(record.messageId)
      continue
    }
    const job = parseJob(record.body)
    if (!job) {
      logger.error("invalid email job", record.messageId)
      continue
    }
    try {
      const { messageId } = await send(job)
      reports.push({ kind: "job", notificationIds: job.notificationIds, status: "sent", sesMessageId: messageId })
    } catch (error) {
      // Error names only: SES messages can contain the recipient address.
      if (error instanceof PermanentSendError) {
        logger.warn("email permanently failed", job.key, error.message)
        reports.push({
          kind: "job",
          notificationIds: job.notificationIds,
          status: "failed",
          reason: error.message.slice(0, 500),
        })
        continue
      }
      logger.warn("email send will retry", job.key, errorName(error))
      failedMessageIds.push(record.messageId)
      haltedGroups.add(record.groupId)
    }
  }
  return { failedMessageIds, reports }
}
