import "server-only"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import {
  getSupabaseUrl,
  getSupabasePublishableKey,
} from "@/lib/config/env"

export async function createSupabaseServerClient() {
  const url = getSupabaseUrl()
  const publishableKey = getSupabasePublishableKey()
  if (!url || !publishableKey) {
    throw new Error(
      "Supabase SSR client is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    )
  }
  const cookieStore = await cookies()
  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot set cookies. The proxy handles refresh.
        }
      },
    },
  })
}
