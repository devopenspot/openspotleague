import "../src/db/load-env"
import postgres from "postgres"
import { getDirectDatabaseUrl, isR2Configured } from "../src/lib/config/env"
import { getPostgresOptions } from "../src/lib/db/postgres-options"
import { getSupabaseAdminClient } from "../src/lib/supabase/admin"
import { r2Adapter } from "../src/lib/storage/r2"

type StorageObject = { bucket_id: string; name: string }

/**
 * Free storage GC: lists orphan objects in spot-images / event-images that are not
 * referenced by any spot / event master path (and its 3 derived variants).
 * Variants are derived as `${master}_128.webp`, `${master}_400.webp`, `${master}_800.webp`.
 * Legacy objects without `.webp` suffix are treated as masters without variants.
 *
 * Supports Supabase (storage.objects) and R2 (S3 ListObjectsV2) via --provider.
 *
 * Usage:
 *   pnpm tsx scripts/storage-gc.ts                              # dry-run, supabase
 *   pnpm tsx scripts/storage-gc.ts --provider r2                # dry-run, R2 (openspotleague-spots/events)
 *   pnpm tsx scripts/storage-gc.ts --provider both               # dry-run, both
 *   pnpm tsx scripts/storage-gc.ts --delete                     # deletes orphans (supabase)
 *   pnpm tsx scripts/storage-gc.ts --provider r2 --delete       # deletes R2 orphans
 */

import { variantPathsList as variantPaths } from "../src/lib/storage/variants"

async function main() {
  const url = getDirectDatabaseUrl()
  if (!url) throw new Error("SUPABASE_DIRECT_URL is not configured")
  const sql = postgres(url, getPostgresOptions("script", { max: 2 }))

  const shouldDelete = process.argv.includes("--delete")
  const providerArg = process.argv.find((a) => a.startsWith("--provider"))
  const provider = providerArg
    ? (providerArg.split("=")[1] ?? process.argv[process.argv.indexOf(providerArg) + 1] ?? "supabase")
    : "supabase"
  const useSupabase = provider === "supabase" || provider === "both"
  const useR2 = provider === "r2" || provider === "both"

  if (useR2 && !isR2Configured()) {
    console.warn("R2 not configured — R2 listing will be skipped. Set R2_* env for R2 GC.")
  }

  try {
    const { extractStoragePath } = await import("../src/lib/storage/variants")
    const spotRows = await sql<{ image_url: string }[]>`select image_url from public.spots where image_url is not null and image_url not like 'https://placeholder.local/%'`
    const eventRows = await sql<{ image_url: string }[]>`select image_url from public.sport_events where image_url is not null and image_url not like 'https://placeholder.local/%'`

    const referenced = new Set<string>()
    for (const row of [...spotRows, ...eventRows]) {
      const path = extractStoragePath(row.image_url)
      if (!path) continue
      for (const p of variantPaths(path)) referenced.add(p)
    }

    const objects: StorageObject[] = []

    if (useSupabase) {
      const supabaseObjects = await sql<StorageObject[]>`select bucket_id, name from storage.objects where bucket_id in ('spot-images','event-images')`
      objects.push(...supabaseObjects)
      console.log(`[supabase] objects: ${supabaseObjects.length}`)
    }

    if (useR2 && isR2Configured()) {
      for (const kind of ["spots", "events"] as const) {
        const bucketId = kind === "spots" ? "openspotleague-spots" : "openspotleague-events"
        // R2 list returns keys without bucket_id prefix; normalize to synthetic bucket_id for grouping
        try {
          const keys = await r2Adapter.list(kind)
          for (const name of keys) objects.push({ bucket_id: bucketId, name })
          console.log(`[r2:${kind}] objects: ${keys.length}`)
        } catch (e) {
          console.warn(`[r2:${kind}] list failed: ${e instanceof Error ? e.message : e}`)
        }
      }
    }

    const orphans = objects.filter((o) => !referenced.has(o.name))

    console.log(`referenced masters+variants: ${referenced.size}`)
    console.log(`total objects in storage: ${objects.length}`)
    console.log(`orphans: ${orphans.length}`)

    const byBucket = new Map<string, string[]>()
    for (const o of orphans) {
      const list = byBucket.get(o.bucket_id) ?? []
      list.push(o.name)
      byBucket.set(o.bucket_id, list)
    }
    for (const [bucket, names] of byBucket) {
      console.log(`\nBucket ${bucket} orphans (${names.length}):`)
      for (const n of names.slice(0, 50)) console.log(`  ${n}`)
      if (names.length > 50) console.log(`  ... and ${names.length - 50} more`)
    }

    if (orphans.length === 0) {
      console.log("\nNo orphans to delete.")
      return
    }

    if (!shouldDelete) {
      console.log("\nDry run. Re-run with --delete to remove orphans.")
      return
    }

    // Delete per provider
    for (const [bucket, names] of byBucket) {
      const isR2Bucket = bucket === "openspotleague-spots" || bucket === "openspotleague-events"
      if (isR2Bucket) {
        const kind = bucket === "openspotleague-spots" ? ("spots" as const) : ("events" as const)
        for (let i = 0; i < names.length; i += 100) {
          const chunk = names.slice(i, i + 100)
          try {
            await r2Adapter.remove(kind, chunk)
            console.log(`Deleted ${chunk.length} objects from R2 ${bucket}`)
          } catch (e) {
            console.error(`Failed to delete chunk in R2 ${bucket}:`, e instanceof Error ? e.message : e)
          }
        }
      } else {
        const supabase = getSupabaseAdminClient()
        for (let i = 0; i < names.length; i += 100) {
          const chunk = names.slice(i, i + 100)
          const { error } = await supabase.storage.from(bucket).remove(chunk)
          if (error) {
            console.error(`Failed to delete chunk in ${bucket}:`, error.message)
          } else {
            console.log(`Deleted ${chunk.length} objects from ${bucket}`)
          }
        }
      }
    }
    console.log("GC delete complete.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => {
  console.error("storage-gc failed:", e)
  process.exitCode = 1
})
