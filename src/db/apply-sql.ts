import "./load-env"
import path from "node:path"
import postgres from "postgres"
import { getDirectDatabaseUrl } from "../lib/config/env"
import { getPostgresOptions } from "../lib/db/postgres-options"
import {
  detectMigrationDrift,
  loadMigrationFiles,
  pendingHashRebaselines,
  pendingMigrationFiles,
} from "./migration-runner"

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations")

function ensureMigrationsTable(sql: ReturnType<typeof postgres>) {
  return sql`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now(),
      hash text
    )
  `
}

async function main() {
  const url = getDirectDatabaseUrl()
  if (!url) throw new Error("SUPABASE_DIRECT_URL is not configured")
  const sql = postgres(url, getPostgresOptions("ddl", { max: 1 }))
  try {
    const migrations = loadMigrationFiles(MIGRATIONS_DIR)
    if (migrations.length === 0) {
      throw new Error(`No SQL migrations found in ${MIGRATIONS_DIR}`)
    }

    await ensureMigrationsTable(sql)
    // Ensure hash column exists for existing deployments (idempotent)
    await sql`alter table schema_migrations add column if not exists hash text`.catch(() => undefined)
    // Use session-level advisory lock so we can run each statement in its own
    // transaction (autocommit). The previous `pg_advisory_xact_lock` inside a
    // single `BEGIN` held all statements in one tx, which makes Postgres fail
    // with `55006 cannot ALTER TABLE ... because it has pending trigger
    // events` when a file mixes DML (UPDATE → fires `bump_verification_count`
    // on spots) followed by DDL (ALTER TABLE DROP COLUMN) in the same tx.
    // Per-statement autocommit clears pending triggers before the next DDL.
    await sql`select pg_advisory_lock(hashtextextended('openspot:database-apply', 0))`
    try {
      const rows = await sql<{ id: string; hash: string | null }[]>`select id, hash from schema_migrations`
      const appliedIds = new Set(rows.map((row) => row.id))
      const appliedHashes = new Map(rows.map((row) => [row.id, row.hash] as const))
      detectMigrationDrift(migrations, appliedHashes)
      for (const migration of pendingHashRebaselines(migrations, appliedHashes)) {
        await sql`update schema_migrations set hash = ${migration.hash} where id = ${migration.id}`
        console.log(`↻ ${migration.file} (ledger hash rebased to v2)`)
      }
      const pending = pendingMigrationFiles(migrations, appliedIds)
      if (pending.length === 0) {
        console.log("✓ migrations (already applied)")
        return
      }
      await sql`set statement_timeout = '120s'`

      for (const migration of pending) {
        console.log(`→ applying ${migration.file}`)
        for (const group of migration.groups) {
          if (group.transactional) {
            try {
              await sql.begin(async (tx) => {
                for (const statement of group.statements) {
                  await tx.unsafe(statement)
                }
              })
            } catch (error) {
              console.error(
                `✗ ${migration.file} tx-group (${group.statements.length} statements) failed`,
              )
              throw error
            }
            continue
          }
          for (const statement of group.statements) {
            try {
              await sql.unsafe(statement)
            } catch (error) {
              console.error(
                `✗ ${migration.file} statement ${migration.statements.indexOf(statement) + 1}/${migration.statements.length} failed`,
              )
              console.error(statement.slice(0, 500))
              throw error
            }
          }
        }
        await sql`insert into schema_migrations (id, hash) values (${migration.id}, ${migration.hash})`
        appliedIds.add(migration.id)
        console.log(`✓ ${migration.file} (applied)`)
      }
    } finally {
      await sql`select pg_advisory_unlock(hashtextextended('openspot:database-apply', 0))`.catch(() => undefined)
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
