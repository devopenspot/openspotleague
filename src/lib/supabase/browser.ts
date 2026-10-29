import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/config/env"
import { createBoundedFetch, DEFAULT_READ_TIMEOUT_MS } from "@/lib/utils/fetch-timeout"

const boundedSupabaseFetch = createBoundedFetch(DEFAULT_READ_TIMEOUT_MS)

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
