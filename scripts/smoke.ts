/**
 * pnpm smoke <develop|production> [baseUrl]
 *
 * Post-deploy check run by the workflows (docs/ci-cd.md). It calls the
 * Worker's workers.dev address by default: Bot Fight Mode and the WAF block
 * GitHub runners on the custom domain, and no rule can skip Bot Fight Mode.
 * Read-only; retries for about a minute while the new version propagates.
 */
const WORKERS_DEV: Record<string, string> = {
  develop: "https://open-spot-develop.devopenspot.workers.dev",
  production: "https://open-spot.devopenspot.workers.dev",
}
const USER_AGENT = "OpenSpot-Deploy-Smoke/1.0 (+https://openspotleague.com)"
const ATTEMPTS = 6
const WAIT_MS = 10_000

const environment = process.argv[2] ?? ""
const base = (process.argv[3] ?? WORKERS_DEV[environment] ?? "").replace(/\/+$/, "")
if (!WORKERS_DEV[environment] || !/^https?:\/\//.test(base)) {
  console.error("Usage: pnpm smoke <develop|production> [baseUrl]")
  process.exit(2)
}

async function get(path: string): Promise<Response> {
  return fetch(base + path, {
    headers: { "User-Agent": USER_AGENT, "Cache-Control": "no-cache" },
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  })
}

type Check = { name: string; run: () => Promise<string | null> }

const checks: Check[] = [
  {
    name: "GET /api/health is ok",
    run: async () => {
      const res = await get("/api/health")
      if (res.status !== 200) return `HTTP ${res.status}`
      const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
      return body?.ok === true ? null : `body ${JSON.stringify(body)}`
    },
  },
  {
    name: "GET / renders",
    run: async () => {
      const res = await get("/")
      if (res.status !== 200) return `HTTP ${res.status}`
      const html = await res.text()
      return html.includes("</html>") ? null : "no HTML document"
    },
  },
  {
    name: environment === "develop" ? "develop is noindex" : "production is indexable",
    run: async () => {
      const res = await get("/")
      const robots = res.headers.get("x-robots-tag") ?? ""
      const noindex = robots.includes("noindex")
      if (environment === "develop") return noindex ? null : `x-robots-tag "${robots}"`
      return noindex ? `x-robots-tag "${robots}" on production` : null
    },
  },
]

async function main() {
  console.log(`smoke ${environment}: ${base}`)
  let failed = checks
  for (let attempt = 1; attempt <= ATTEMPTS && failed.length > 0; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, WAIT_MS))
    const results = await Promise.all(
      failed.map(async (check) => ({ check, problem: await check.run().catch((e: unknown) => String(e)) })),
    )
    for (const { check, problem } of results) {
      console.log(`${problem ? "✗" : "✓"} ${check.name}${problem ? ` (attempt ${attempt}: ${problem})` : ""}`)
    }
    failed = results.filter((r) => r.problem).map((r) => r.check)
  }
  if (failed.length > 0) process.exit(1)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
