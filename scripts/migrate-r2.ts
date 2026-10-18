import "../src/db/load-env"
import postgres from "postgres"
import { getDirectDatabaseUrl } from "../src/lib/config/env"
import { getPostgresOptions } from "../src/lib/db/postgres-options"
import { getSupabaseAdminClient } from "../src/lib/supabase/admin"
import { r2Adapter } from "../src/lib/storage/r2"
import { getR2PublicDomainEvents, getR2PublicDomainSpots, isR2Configured } from "../src/lib/config/env"

/**
 * DB-driven R2 migration: copies all referenced spot/event image variants
 * from Supabase Storage (spot-images/event-images) to R2
 * (openspotleague-spots/openspotleague-events) via download → put.
 *
 * Keeps the SAME object key (spots/{id}/{uuid}.webp and variants) so
 * existing DB `image_path` rows instantly resolve to https://<cdn>/<key>
 * once STORAGE_PROVIDER=r2. No DB migration, no compaction.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-r2.ts --dry-run          # lists what would copy
 *   pnpm tsx scripts/migrate-r2.ts                     # copies (32 concurrent)
 *   pnpm tsx scripts/migrate-r2.ts --spots-only
 *   pnpm tsx scripts/migrate-r2.ts --events-only
 *   pnpm tsx scripts/migrate-r2.ts --limit 10          # smoke test
 */

import { variantPathsList as variantPaths } from "../src/lib/storage/variants"
import { buildCacheTag as cacheTagFor } from "../src/lib/storage/cache-tag"

async function downloadFromSupabase(supabaseBucket: string, key: string): Promise<Buffer | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.storage.from(supabaseBucket).download(key)
  if (error) {
    // 400/Object not found is expected for missing variants (legacy non-webp)
    if (error.message.toLowerCase().includes("not found") || error.message.includes("Object not found")) return null
    throw new Error(`Supabase download failed ${supabaseBucket}/${key}: ${error.message}`)
  }
  if (!data) return null
  const ab = await (data as Blob).arrayBuffer()
  return Buffer.from(ab)
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const spotsOnly = args.includes("--spots-only")
  const eventsOnly = args.includes("--events-only")
  const limitArg = args.find((a) => a.startsWith("--limit"))
  const limit = limitArg ? Number(limitArg.split("=")[1] ?? args[args.indexOf(limitArg) + 1]) : undefined

  if (!isR2Configured()) {
    console.error("R2 not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_DOMAIN_*")
    process.exitCode = 1
    return
  }

  console.log(`R2 domains: spots=${getR2PublicDomainSpots()} events=${getR2PublicDomainEvents()}`)
  console.log(`Mode: ${dryRun ? "dry-run" : "copy"} ${spotsOnly ? "(spots only)" : eventsOnly ? "(events only)" : ""} ${limit ? `limit=${limit}` : ""}`)

  const url = getDirectDatabaseUrl()
  if (!url) throw new Error("SUPABASE_DIRECT_URL is not configured")
  const sql = postgres(url, getPostgresOptions("script", { max: 2 }))

  // Deprecated after 0021_drop_image_path: image_path is gone. This script is kept for archive
  // and now derives the storage key from image_url (CDN URL).
  const { extractStoragePath } = await import("../src/lib/storage/variants")
  try {
    const spotRows = spotsOnly || !eventsOnly
      ? await sql<{ image_url: string }[]>`select image_url from public.spots where image_url is not null and image_url not like 'https://placeholder.local/%'`
      : []
    const eventRows = eventsOnly || !spotsOnly
      ? await sql<{ image_url: string }[]>`select image_url from public.sport_events where image_url is not null and image_url not like 'https://placeholder.local/%'`
      : []

    type Item = { bucket: "spots" | "events"; supabaseBucket: string; key: string }
    const items: Item[] = []
    for (const row of spotRows) {
      const path = extractStoragePath(row.image_url)
      if (!path) continue
      for (const k of variantPaths(path)) items.push({ bucket: "spots", supabaseBucket: "spot-images", key: k })
    }
    for (const row of eventRows) {
      const path = extractStoragePath(row.image_url)
      if (!path) continue
      for (const k of variantPaths(path)) items.push({ bucket: "events", supabaseBucket: "event-images", key: k })
    }

    // Unique
    const seen = new Set<string>()
    const unique: Item[] = []
    for (const it of items) {
      const memo = `${it.bucket}:${it.key}`
      if (!seen.has(memo)) {
        seen.add(memo)
        unique.push(it)
      }
    }

    const sliced = limit ? unique.slice(0, limit) : unique
    console.log(`Referenced variants (unique): ${unique.length} -> processing ${sliced.length}`)

    // List existing R2 keys to skip already-present
    const existingByBucket = new Map<string, Set<string>>()
    for (const bucket of ["spots", "events"] as const) {
      if (spotsOnly && bucket !== "spots") continue
      if (eventsOnly && bucket !== "events") continue
      try {
        const keys = await r2Adapter.list(bucket)
        existingByBucket.set(bucket, new Set(keys))
        console.log(`R2 ${bucket}: ${keys.length} existing objects`)
      } catch (e) {
        console.warn(`R2 list failed for ${bucket}: ${e instanceof Error ? e.message : e}`)
        existingByBucket.set(bucket, new Set())
      }
    }

    const toCopy = sliced.filter((it) => !existingByBucket.get(it.bucket)?.has(it.key))
    console.log(`To copy (missing in R2): ${toCopy.length} / ${sliced.length}`)

    if (dryRun) {
      for (const it of toCopy.slice(0, 50)) console.log(`  + ${it.bucket}/${it.key}`)
      if (toCopy.length > 50) console.log(`  ... and ${toCopy.length - 50} more`)
      console.log("\nDry run done. Re-run without --dry-run to copy.")
      return
    }

    let copied = 0
    let skippedMissing = 0
    let failed = 0
    const concurrency = 8
    for (let i = 0; i < toCopy.length; i += concurrency) {
      const chunk = toCopy.slice(i, i + concurrency)
      await Promise.all(
        chunk.map(async (it) => {
          try {
            const buf = await downloadFromSupabase(it.supabaseBucket, it.key)
            if (!buf) {
              skippedMissing++
              return
            }
            await r2Adapter.put(it.bucket, it.key, buf, {
              contentType: "image/webp",
              cacheControl: "public, max-age=31536000, immutable",
              cacheTag: cacheTagFor(it.bucket, it.key),
            })
            copied++
            if (copied % 100 === 0) console.log(`  ... copied ${copied}/${toCopy.length}`)
          } catch (e) {
            failed++
            console.error(`  ! failed ${it.bucket}/${it.key}: ${e instanceof Error ? e.message : e}`)
          }
        }),
      )
    }

    console.log(`\nDone: copied=${copied} skippedMissing=${skippedMissing} failed=${failed}`)
    if (failed > 0) process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => {
  console.error("migrate-r2 failed:", e)
  process.exitCode = 1
})
