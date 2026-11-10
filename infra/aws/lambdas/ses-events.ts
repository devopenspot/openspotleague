/**
 * SES configuration-set events (via SNS) → suppression in the app.
 * Only permanent bounces and complaints suppress an address; transient
 * bounces are ignored (SES already retried them). SES's account-level
 * suppression list also blocks these addresses at the SES side.
 */

import type { SNSEvent } from "aws-lambda"
import type { DeliveryReport } from "../../../src/lib/notifications/delivery/contract"
import { reportDelivery } from "./shared/app-client"

interface SesEvent {
  eventType?: string
  notificationType?: string
  bounce?: { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] }
  complaint?: { complainedRecipients?: { emailAddress?: string }[] }
}

export function toReports(message: SesEvent): DeliveryReport["reports"] {
  const type = message.eventType ?? message.notificationType
  if (type === "Bounce" && message.bounce?.bounceType === "Permanent") {
    return (message.bounce.bouncedRecipients ?? [])
      .map((recipient) => recipient.emailAddress)
      .filter((email): email is string => Boolean(email))
      .map((email) => ({ kind: "feedback" as const, email, status: "bounced" as const }))
  }
  if (type === "Complaint") {
    return (message.complaint?.complainedRecipients ?? [])
      .map((recipient) => recipient.emailAddress)
      .filter((email): email is string => Boolean(email))
      .map((email) => ({ kind: "feedback" as const, email, status: "complained" as const }))
  }
  return []
}

export async function handler(event: SNSEvent): Promise<void> {
  const reports: DeliveryReport["reports"] = []
  for (const record of event.Records) {
    try {
      reports.push(...toReports(JSON.parse(record.Sns.Message) as SesEvent))
    } catch {
      console.warn("unparseable SES event", record.Sns.MessageId)
    }
  }
  // Throwing makes Lambda retry the SNS delivery; reporting twice is harmless.
  if (reports.length > 0) await reportDelivery(reports, { throwOnFailure: true })
}
