/**
 * Minimal SQS producer for the Worker: `SendMessageBatch` over the AWS JSON
 * protocol, SigV4-signed with aws4fetch (tiny, made for Workers) instead of
 * the full AWS SDK. FIFO queue: `MessageGroupId` = user (per-user order) and
 * `MessageDeduplicationId` = job key (5-minute dedup absorbs re-enqueues).
 */

import { AwsClient } from "aws4fetch"
import type { NotifyAwsConfig } from "@/lib/config/env"
import type { EmailJob } from "./contract"

export const SQS_BATCH_LIMIT = 10

export interface QueueMessage {
  /** Batch entry id, echoed back in the result (≤ 80 chars, [A-Za-z0-9_-]). */
  id: string
  groupId: string
  job: EmailJob
}

export interface BatchResult {
  succeeded: string[]
  failed: { id: string; reason: string }[]
}

type Fetcher = (request: Request) => Promise<Response>

export function createSqsSender(config: NotifyAwsConfig, fetcher?: Fetcher) {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    region: config.region,
    service: "sqs",
  })
  const endpoint = `https://sqs.${config.region}.amazonaws.com/`

  async function sendChunk(messages: readonly QueueMessage[]): Promise<BatchResult> {
    const body = JSON.stringify({
      QueueUrl: config.queueUrl,
      Entries: messages.map((message) => ({
        Id: message.id,
        MessageBody: JSON.stringify(message.job),
        MessageGroupId: message.groupId,
        MessageDeduplicationId: message.job.key,
      })),
    })
    const request = await client.sign(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-amz-json-1.0",
        "x-amz-target": "AmazonSQS.SendMessageBatch",
      },
      body,
    })
    let response: Response
    try {
      response = await (fetcher ?? fetch)(request)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return { succeeded: [], failed: messages.map((m) => ({ id: m.id, reason })) }
    }
    if (!response.ok) {
      const reason = `SQS ${response.status}: ${(await response.text()).slice(0, 300)}`
      return { succeeded: [], failed: messages.map((m) => ({ id: m.id, reason })) }
    }
    const result = (await response.json()) as {
      Successful?: { Id: string }[]
      Failed?: { Id: string; Message?: string; Code?: string }[]
    }
    return {
      succeeded: (result.Successful ?? []).map((entry) => entry.Id),
      failed: (result.Failed ?? []).map((entry) => ({
        id: entry.Id,
        reason: entry.Message ?? entry.Code ?? "unknown",
      })),
    }
  }

  return {
    /** Sends in chunks of 10; never throws — failures come back per id. */
    async send(messages: readonly QueueMessage[]): Promise<BatchResult> {
      const total: BatchResult = { succeeded: [], failed: [] }
      for (let index = 0; index < messages.length; index += SQS_BATCH_LIMIT) {
        const chunk = await sendChunk(messages.slice(index, index + SQS_BATCH_LIMIT))
        total.succeeded.push(...chunk.succeeded)
        total.failed.push(...chunk.failed)
      }
      return total
    },
  }
}

export type SqsSender = ReturnType<typeof createSqsSender>
