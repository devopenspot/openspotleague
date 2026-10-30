import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/config/env"
import { createBoundedFetch, DEFAULT_READ_TIMEOUT_MS } from "@/lib/utils/fetch-timeout"

const boundedSupabaseFetch = createBoundedFetch(DEFAULT_READ_TIMEOUT_MS)

let channelTopicSequence = 0

/**
 * Unique realtime topic per subscription attempt. `@supabase/ssr` returns a
 * singleton browser client and realtime-js `client.channel(topic)` returns
 * the EXISTING channel when the topic is already registered — including one
 * still leaving after `removeChannel()`. Re-subscribing under the same topic
 * therefore reattaches to a dying channel (duplicate bindings, no JOIN, then
 * a late CLOSED that flips the caller back to "unhealthy"). postgres_changes
 * routing lives in the channel config (`filter`), not the topic name, so a
 * per-attempt suffix is safe.
 */
export function uniqueChannelTopic(base: string): string {
  channelTopicSequence += 1
  return `${base}:${channelTopicSequence}`
}

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  if (!url || !key) throw new Error("Supabase is not configured")
  return createBrowserClient(url, key, {
    global: {
      fetch: boundedSupabaseFetch,
    },
  })
}
