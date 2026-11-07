/**
 * Server entry for email delivery: wires the dispatcher from env and exposes
 * the after-commit hook `createNotifications` calls. With the AWS env unset
 * (local dev, tests, before the stack exists) delivery is off: rows stay
 * `pending` and nothing leaves the Worker.
 */

import "server-only"

import {
  env,
  getNotificationsUnsubscribeSecret,
  getNotifyAwsConfig,
} from "@/lib/config/env"
import { queueAfterCommit } from "@/lib/cache/deferred"
import { log } from "@/lib/utils/log"
import { createDispatcher, type Dispatcher } from "./dispatcher"
import { createSqsSender } from "./sqs"
import { deliveryStore } from "./store"

export function isEmailDeliveryConfigured(): boolean {
  return getNotifyAwsConfig() !== null && getNotificationsUnsubscribeSecret() !== null
}

/** The live dispatcher, or null while delivery is not configured. */
export function getDispatcher(): Dispatcher | null {
  const aws = getNotifyAwsConfig()
  const unsubscribeSecret = getNotificationsUnsubscribeSecret()
  if (!aws || !unsubscribeSecret) return null
  return createDispatcher({
    store: deliveryStore,
    sender: createSqsSender(aws),
    appUrl: env.APP_URL,
    unsubscribeSecret,
  })
}

/**
 * Queue immediate-urgency rows for email once the surrounding write commits.
 * A failure only logs: the tick backstop re-enqueues pending rows.
 */
export function queueImmediateEmails(ids: readonly string[]): void {
  if (ids.length === 0 || !isEmailDeliveryConfigured()) return
  queueAfterCommit("notifications.dispatchImmediate", async () => {
    const dispatcher = getDispatcher()
    if (!dispatcher) return
    const counts = await dispatcher.dispatchImmediate(ids)
    if (counts.retry > 0) log.warn("notifications.dispatch_retry", counts)
  })
}
