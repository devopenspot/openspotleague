/**
 * EventBridge Scheduler → this Lambda every 15 minutes → signed POST to the
 * Worker's `/api/internal/notifications/tick` (reminders, backstop, digests).
 * The Worker owns all data access; this function only knocks on the door.
 * A non-2xx throws so the invocation shows up as an error in CloudWatch.
 */

import { postToApp } from "./shared/app-client"

export async function handler(): Promise<unknown> {
  const response = await postToApp("/api/internal/notifications/tick", { at: new Date().toISOString() })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`tick failed: ${response.status} ${text.slice(0, 300)}`)
  }
  console.log("tick", text.slice(0, 1000))
  return JSON.parse(text) as unknown
}
