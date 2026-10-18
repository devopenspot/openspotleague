import { getEventImagesBucket, getSpotImagesBucket } from "@/lib/config/env"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"
import type { BucketKind, StorageAdapter } from "./adapter"

function bucketName(kind: BucketKind): string {
  return kind === "spots" ? getSpotImagesBucket() : getEventImagesBucket()
}

export const supabaseAdapter: StorageAdapter = {
  getPublicUrl(bucket, path) {
    return getSupabaseAdminClient().storage.from(bucketName(bucket)).getPublicUrl(path).data.publicUrl
  },

  async put(bucket, key, body, opts) {
    const { error } = await getSupabaseAdminClient()
      .storage.from(bucketName(bucket))
      .upload(key, body, {
        cacheControl: opts.cacheControl,
        upsert: false,
        contentType: opts.contentType,
      })
    if (error) throw new Error(`Supabase upload failed (${bucket}/${key}): ${error.message}`)
  },

  async remove(bucket, keys) {
    if (keys.length === 0) return
    const supabase = getSupabaseAdminClient()
    const name = bucketName(bucket)
    const { error } = await supabase.storage.from(name).remove(keys)
    if (!error) return
    let masterError: string | null = null
    for (const k of keys) {
      const { error: e } = await supabase.storage.from(name).remove([k])
      if (e && k === keys[0]) masterError = e.message
    }
    if (masterError) throw new Error(`Supabase remove failed: ${masterError}`)
  },

  async list(bucket) {
    // Supabase list via storage API is paginated; for GC we use DB storage.objects instead.
    // This fallback lists via storage API with 1000 limit.
    const supabase = getSupabaseAdminClient()
    const name = bucketName(bucket)
    const { data, error } = await supabase.storage.from(name).list("", { limit: 1000 })
    if (error) throw new Error(`Supabase list failed: ${error.message}`)
    return (data ?? []).map((o) => o.name).filter(Boolean)
  },
}
