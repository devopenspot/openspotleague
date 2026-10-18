import { createBrowserClient } from "@supabase/ssr"
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/config/env"

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()
  if (!url || !key) throw new Error("Supabase is not configured")
  return createBrowserClient(url, key)
}
