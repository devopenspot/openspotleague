/**
 * pnpm og:check [baseUrl]
 *
 * Fetches each static-card page the way a link-unfurl crawler would, reads
 * its share tags, then downloads the image. Read-only, no DB. The base URL
 * defaults to APP_URL from .env.local. Exits 1 when anything fails.
 * See docs/og-cards.md → "Checking a deploy".
 */
import "../src/db/load-env"
import {
  OG_CHECK_PATHS,
  OG_CHECK_USER_AGENT,
  describeFetchError,
  imageProblems,
  parseShareTags,
  shareTagProblems,
} from "@/lib/og/check"

const TIMEOUT_MS = 20_000

async function get(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": OG_CHECK_USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
}

async function main() {
  const base = (process.argv[2] ?? process.env.APP_URL ?? "").replace(/\/+$/, "")
  if (!/^https?:\/\//.test(base)) {
    console.error("Usage: pnpm og:check [baseUrl]   (or set APP_URL in .env.local)")
    process.exit(2)
  }
  console.log(`og:check ${base}\n`)

  const imageCache = new Map<string, string[]>()
  let failures = 0

  for (const path of OG_CHECK_PATHS) {
    const pageUrl = base + path
    let problems: string[] = []
    let image: string | null = null

    try {
      const res = await get(pageUrl)
      if (res.status !== 200) {
        problems.push(`page returned HTTP ${res.status}`)
      } else {
        // Judge the tags against the host that finally served the page.
        const tags = parseShareTags(await res.text())
        image = tags.image
        problems.push(...shareTagProblems(tags, res.url || pageUrl))
      }
    } catch (error) {
      problems.push(`page: ${describeFetchError(error, pageUrl)}`)
    }

    if (image) {
      let imageResult = imageCache.get(image)
      if (!imageResult) {
        try {
          const res = await get(image)
          const bytes = (await res.arrayBuffer()).byteLength
          imageResult = imageProblems({ status: res.status, contentType: res.headers.get("content-type"), bytes })
        } catch (error) {
          imageResult = [describeFetchError(error, image)]
        }
        imageCache.set(image, imageResult)
      }
      problems = [...problems, ...imageResult]
    }

    if (problems.length) failures++
    console.log(`${problems.length ? "FAIL" : "ok  "}  ${path.padEnd(24)} ${image ?? "(no image)"}`)
    for (const p of problems) console.log(`        - ${p}`)
  }

  console.log(failures ? `\n${failures} of ${OG_CHECK_PATHS.length} pages failed.` : "\nAll share images load.")
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
