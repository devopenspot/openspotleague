import "./load-env"
import { runDbConnectivityCheck } from "../lib/services/profile/health"
import { getDbPoolMax } from "../lib/db/client"

const PARALLEL = Math.max(getDbPoolMax() * 2, 2)

interface TimedResult {
  index: number
  ok: boolean
  latencyMs: number
  error?: string
}

async function probe(i: number): Promise<TimedResult> {
  const r = await runDbConnectivityCheck()
  return {
    index: i,
    ok: r.ok,
    latencyMs: r.latencyMs,
    error: r.error,
  }
}

async function main() {
  const started = Date.now()
  const results = await Promise.all(
    Array.from({ length: PARALLEL }, (_, i) => probe(i)),
  )
  const elapsed = Date.now() - started
  const ok = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok)

  const max = Math.max(...results.map((r) => r.latencyMs), 0)
  const min = results.length
    ? Math.min(...results.map((r) => r.latencyMs))
    : 0
  const avg =
    results.length === 0
      ? 0
      : Math.round(
          results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length,
        )

  console.log(
    `db:check-pool → ${ok.length}/${results.length} ok  ` +
      `min=${min}ms avg=${avg}ms max=${max}ms total=${elapsed}ms`,
  )

  for (const r of failed) {
    console.log(`  #${r.index}  FAILED  ${r.error ?? "unknown error"}`)
  }

  if (failed.length > 0) process.exit(1)
}

main().catch((err) => {
  console.error(
    "db:check-pool crashed:",
    err instanceof Error ? err.message : err,
  )
  process.exit(1)
})
