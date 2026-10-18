import "./load-env"
import { runDbHealthCheck } from "../lib/services/profile/health"

async function main() {
  const result = await runDbHealthCheck()
  const status = result.ok ? "ok" : "fail"
  console.log(
    `db:health → ${status}  source=${result.source}  latencyMs=${result.latencyMs}` +
      (result.error ? `  error=${result.error}` : ""),
  )
  if (result.statementTimeout && !result.statementTimeout.ok) {
    console.log(
      `  statement_timeout: configured=${result.statementTimeout.configuredMs}ms ` +
        `effective=${result.statementTimeout.serverValue ?? "unknown"} ` +
        `pooler_default=${result.statementTimeout.serverDefaultValue ?? "unknown"}`,
    )
  }
  if (result.migration && !result.migration.ok) {
    console.log(
      `  migration: expected=${result.migration.expected} ` +
        `actual=${result.migration.actual ?? "missing"}`,
    )
  }
  if (result.realtime && !result.realtime.ok) {
    console.log(
      `  realtime: ${result.realtime.publication} missing ${result.realtime.signalTable}`,
    )
  }
  process.exit(result.ok ? 0 : 1)
}

main().catch((err) => {
  console.error("db:health crashed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
