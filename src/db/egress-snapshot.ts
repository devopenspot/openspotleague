import "./load-env"
import { getDatabaseUrl } from "../lib/config/env"
import fs from "node:fs"
import path from "node:path"
import postgres from "postgres"

interface StatementSnapshot {
  id: string
  calls: number
  rows: number
  avgRows: number
  query: string
}

interface EgressSnapshot {
  capturedAt: string
  statsReset: string | null
  statements: StatementSnapshot[]
}

interface StatementDelta extends StatementSnapshot {
  dCalls: number
  dRows: number
  isNew: boolean
}

const EGRESS_DIR = path.join(process.cwd(), ".local", "egress")
const SNAPSHOT_PREFIX = "egress-snapshot-"
const TOP_LIMIT = 2000
const DAILY_CEILING_MB = 160

function todayLocal(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function nowIso(): string {
  return new Date().toISOString()
}

async function readStatsReset(
  sql: postgres.Sql,
): Promise<string | null> {
  try {
    const rows = await sql<[{ statsReset: string | null }]>`
      select stats_reset::text as "statsReset" from pg_stat_statements_info;
    `
    return rows[0]?.statsReset ?? null
  } catch {
    return null
  }
}

async function readStatements(
  sql: postgres.Sql,
): Promise<StatementSnapshot[]> {
  const raw = await sql<[{ id: string; calls: string; rows: string; query: string }]>`
    select
      s.queryid::text as id,
      s.calls::text as calls,
      s.rows::text as rows,
      left(regexp_replace(s.query, '(\\r?\\n|\\t)+', ' ', 'g'), 240) as query
    from pg_stat_statements s
    join pg_database d on d.oid = s.dbid and d.datname = current_database()
    where s.rows > 0
      and s.query not like '%pg_stat_statements%'
      and s.query not like 'EXPLAIN%'
    order by s.rows desc
    limit ${TOP_LIMIT};
  `
  return raw.map((r) => {
    const calls = Number(r.calls)
    const rows = Number(r.rows)
    return {
      id: r.id,
      calls,
      rows,
      avgRows: Math.round(rows / Math.max(calls, 1)),
      query: r.query,
    }
  })
}

function findPreviousSnapshot(outName: string): EgressSnapshot | null {
  if (!fs.existsSync(EGRESS_DIR)) return null
  const files = fs
    .readdirSync(EGRESS_DIR)
    .filter((f) => f.startsWith(SNAPSHOT_PREFIX) && f.endsWith(".json") && f !== outName)
    .sort()
  if (files.length === 0) return null
  const latest = files[files.length - 1]
  if (!latest) return null
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(EGRESS_DIR, latest), "utf8"),
    ) as EgressSnapshot
    return parsed.statements ? parsed : null
  } catch {
    console.warn(`egress:snapshot — could not parse previous snapshot ${latest}, skipping diff`)
    return null
  }
}

function diffStatements(
  prev: EgressSnapshot,
  current: StatementSnapshot[],
): StatementDelta[] {
  const prevById = new Map(prev.statements.map((s) => [s.id, s]))
  return current
    .map((s) => {
      const p = prevById.get(s.id)
      if (!p) return { ...s, dCalls: s.calls, dRows: s.rows, isNew: true }
      return {
        ...s,
        dCalls: s.calls - p.calls,
        dRows: s.rows - p.rows,
        isNew: false,
      }
    })
    .filter((d) => d.dRows > 0)
    .sort((a, b) => b.dRows - a.dRows)
}

function formatDelta(delta: StatementDelta, index: number): string {
  const tag = delta.isNew ? " (new)" : ""
  const query = delta.query.length > 100 ? `${delta.query.slice(0, 100)}…` : delta.query
  const rows = `${delta.dRows.toLocaleString("en-US")} rowsΔ`
  const calls = `${delta.dCalls.toLocaleString("en-US")} callsΔ`
  const perCall = `~${delta.avgRows.toLocaleString("en-US")} rows/call`
  return [
    `  #${String(index + 1).padStart(2, " ")}`,
    rows.padStart(13, " "),
    calls.padStart(12, " "),
    perCall.padEnd(16, " "),
    tag,
    query,
  ].join("  ")
}

function printDiff(deltas: StatementDelta[], statsResetChanged: boolean): void {
  if (deltas.length === 0) {
    console.log("egress:snapshot — no statement grew since the previous snapshot")
    return
  }
  if (statsResetChanged) {
    console.warn("⚠ stats_reset changed since the previous snapshot — DB restarted;")
    console.warn("  the diff below is a rough guide, today's snapshot is the new baseline")
  }
  console.log(`egress:snapshot — top growth since previous snapshot (top ${deltas.length} positive):`)
  for (const [i, d] of deltas.slice(0, 30).entries()) {
    console.log(formatDelta(d, i))
  }
}

function appendLedger(
  date: string,
  topDelta: StatementDelta | null,
  outputName: string,
): void {
  const ledgerPath = path.join(EGRESS_DIR, "ledger.md")
  let lines: string[] = []
  if (fs.existsSync(ledgerPath)) {
    try {
      lines = fs.readFileSync(ledgerPath, "utf8").split("\n")
    } catch {
      lines = []
    }
  }
  const content = lines.filter((l) => l.trim().length > 0)
  const last = content[content.length - 1]
  if (last?.startsWith(`- ${date} `)) {
    console.log("egress:snapshot — ledger already has today's entry, not appending again")
    return
  }
  if (content.length === 0) {
    content.push(
      "# Egress watch ledger (Shared Pooler Egress)",
      "# Clearing: 5 GB/mon ≈ safe ceiling 160 MB/day; steady-state target ≤ 120 MB/day",
      "# Fill MB (yesterday's dashboard bar) and verdict by hand each day.",
      "",
    )
  }
  const top =
    topDelta === null
      ? "none"
      : `"${topDelta.query.slice(0, 80)}${topDelta.query.length > 80 ? "…" : ""}"`
  content.push(
    `- ${date} · MB=____ · verdict=____ · rowsΔ top: ${top} · notes: snapshot ${outputName}`,
    "",
  )
  fs.writeFileSync(ledgerPath, `${content.join("\n")}\n`, "utf8")
  console.log(`egress:snapshot — ledger updated (${path.relative(process.cwd(), ledgerPath)})`)
  console.log(`  pace reminder: ${DAILY_CEILING_MB} MB/day keeps you inside the 5 GB monthly pooler quota`)
}

async function main(): Promise<void> {
  const url = getDatabaseUrl()
  if (!url) {
    console.error("egress:snapshot — SUPABASE_DATABASE_URL / SUPABASE_DIRECT_URL not configured")
    process.exit(1)
  }
  const date = todayLocal()
  const outputName = `${SNAPSHOT_PREFIX}${date}.json`
  const outputPath = path.join(EGRESS_DIR, outputName)
  if (fs.existsSync(outputPath)) {
    console.error(
      `egress:snapshot — ${outputName} already exists (one snapshot per day). Use the most recent diff instead.`,
    )
    process.exit(1)
  }

  const sql = postgres(url, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
  })
  try {
    const previous = findPreviousSnapshot(outputName)
    const statsReset = await readStatsReset(sql)
    const statements = await readStatements(sql)
    const snapshot: EgressSnapshot = {
      capturedAt: nowIso(),
      statsReset,
      statements,
    }
    fs.mkdirSync(EGRESS_DIR, { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), "utf8")

    console.log(
      `egress:snapshot — captured ${statements.length} statements → ${path.relative(process.cwd(), outputPath)}`,
    )
    if (!previous) {
      console.log("egress:snapshot — baseline established; run again tomorrow for the first diff")
    } else {
      const statsResetChanged =
        previous.statsReset !== null && statsReset !== null && previous.statsReset !== statsReset
      const deltas = diffStatements(previous, statements)
      printDiff(deltas, statsResetChanged)
      appendLedger(date, deltas[0] ?? null, outputName)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error(
    "egress:snapshot crashed:",
    err instanceof Error ? err.message : err,
  )
  process.exit(1)
})
