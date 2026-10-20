import "../src/db/load-env"
import fs from "node:fs"
import path from "node:path"
import { cdnUrlToVariantUrl } from "@/lib/storage/variants"

interface SpotJsonItem {
  id: string
  name: string
  image_url: string | null
  images?: string[]
}

function parseCliArgs() {
  const args = process.argv.slice(2)
  let limit = 50
  let checkAll = false
  let checkVariants = true

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--all") {
      checkAll = true
    } else if (arg === "--limit" && args[i + 1]) {
      limit = parseInt(args[i + 1]!, 10)
      i++
    } else if (arg === "--no-variants") {
      checkVariants = false
    }
  }

  return { limit: checkAll ? Infinity : limit, checkAll, checkVariants }
}

async function checkUrl(url: string): Promise<{ ok: boolean; status: number; durationMs: number; error?: string }> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "User-Agent": "OpenSpot-CDN-Check/1.0" },
    })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status, durationMs: Date.now() - start }
  } catch (err) {
    clearTimeout(timer)
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function main() {
  const { limit, checkAll, checkVariants } = parseCliArgs()
  console.log(`\n========================================`)
  console.log(`OpenSpot Cloudflare CDN Verification`)
  console.log(`========================================\n`)

  const filePath = path.join(process.cwd(), "src", "data", "spots.json")
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as SpotJsonItem[]
  const spotsWithImages = raw.filter((s) => s.image_url && !s.image_url.includes("placeholder.local"))
  console.log(`Loaded ${raw.length} spots (${spotsWithImages.length} with images)`)

  const toCheck = spotsWithImages.slice(0, limit)
  console.log(`Testing ${toCheck.length} spot images ${checkVariants ? "(master + _400 + _128 variants)" : "(master only)"}...\n`)

  let successCount = 0
  let failCount = 0
  let totalRequests = 0

  for (let i = 0; i < toCheck.length; i++) {
    const spot = toCheck[i]!
    const masterUrl = spot.image_url!

    const urlsToTest = [masterUrl]
    if (checkVariants) {
      urlsToTest.push(cdnUrlToVariantUrl(masterUrl, "card"))
      urlsToTest.push(cdnUrlToVariantUrl(masterUrl, "thumb"))
    }

    for (const url of urlsToTest) {
      totalRequests++
      const result = await checkUrl(url)
      const basename = url.split("/").pop() ?? url

      if (result.ok) {
        successCount++
        process.stdout.write(`  [${i + 1}/${toCheck.length}] ✓ ${result.status} ${basename} (${result.durationMs}ms)\n`)
      } else {
        failCount++
        const reason = result.error ? `ERR: ${result.error}` : `HTTP ${result.status}`
        process.stdout.write(`  [${i + 1}/${toCheck.length}] ✗ ${reason} - ${url}\n`)
      }
    }
  }

  console.log(`\n========================================`)
  console.log(`CDN Verification Summary:`)
  console.log(`- Total Requests: ${totalRequests}`)
  console.log(`- Success: ${successCount} (${Math.round((successCount / totalRequests) * 100 || 0)}%)`)
  console.log(`- Failures: ${failCount}`)
  console.log(`========================================\n`)

  if (failCount > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error("verify-cdn error:", err)
  process.exit(1)
})
