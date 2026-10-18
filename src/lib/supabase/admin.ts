import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import {
  getSupabaseAdminUrl,
  getSupabaseServiceRoleKey,
} from "@/lib/config/env"

let cachedAdmin: SupabaseClient | null = null

export function getSupabaseAdminClient(): SupabaseClient {
  const url = getSupabaseAdminUrl()
  const key = getSupabaseServiceRoleKey()
  if (!url || !key) {
    throw new Error(
      "Supabase admin client is not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY",
    )
  }
  if (cachedAdmin) return cachedAdmin

  cachedAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedAdmin
}
