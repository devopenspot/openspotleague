import { cacheLife, cacheTag } from "next/cache"
import { sql } from "drizzle-orm"
import path from "node:path"
import { readdirSync } from "node:fs"
import {
  dbRuntimeConfig,
  getDbClient,
  withRetry,
} from "@/lib/db/client"
import { HEALTH_CACHE_LIFE } from "@/lib/cache/lifetimes"

export const FALLBACK_EXPECTED_MIGRATION_ID = "0004_curated_cities_geo_search"

export function getExpectedMigrationId(): string {
  try {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations")
    const ids = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => path.basename(file, ".sql"))
      .sort((a, b) => a.localeCompare(b))
    if (ids.length > 0) return ids[ids.length - 1] as string
  } catch {
    // filesystem unavailable (e.g. edge runtime or bundled deploy) — fall back to baked constant
  }
  return FALLBACK_EXPECTED_MIGRATION_ID
}

export interface DbHealthComponent {
  ok: boolean
  error?: string
}

export interface DbHealth {
  ok: boolean
  latencyMs: number
  source: "db" | "json"
  error?: string
  connectivity?: DbHealthComponent & { latencyMs: number }
  statementTimeout?: DbHealthComponent & {
    configuredMs: number
    actualMs: number | null
    serverValue: string | null
    serverDefaultValue: string | null
    /**
     * Whether the timeout applies OUTSIDE a transaction (startup parameter
     * honored by the pooler). Informational: transaction-free reads rely on it.
     */
    serverDefaultOk: boolean
  }
  postgis?: DbHealthComponent & { version: string | null }
  migration?: DbHealthComponent & {
    expected: string
    actual: string | null
    tablePresent: boolean
  }
  realtime?: DbHealthComponent & {
    publication: string
    signalTable: string
  }
}

export function parsePostgresDurationMs(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(ms|s|min|h)$/i)
  if (!match) {
    const numeric = Number(value.trim())
    return Number.isFinite(numeric) ? numeric : null
  }
  const amount = Number(match[1])
  const unit = match[2]?.toLowerCase()
  const multiplier =
    unit === "h"
      ? 60 * 60 * 1000
      : unit === "min"
        ? 60 * 1000
        : unit === "s"
          ? 1000
          : 1
  return Math.round(amount * multiplier)
}

type HealthDb = ReturnType<typeof getDbClient>["db"]

async function executeHealthQuery<T extends Record<string, unknown>>(
  db: HealthDb,
  query: ReturnType<typeof sql>,
  label: string,
): Promise<T | undefined> {
  const rows = await withRetry(
    () => db.execute<T>(query),
    {
      maxAttempts: 1,
      label,
      retryOnConnectionError: false,
      allowUncancelableTimeout: false,
    },
  )
  return rows[0] as T | undefined
}

async function probe<T extends Record<string, unknown>>(
  db: HealthDb,
  label: string,
  query: ReturnType<typeof sql>,
): Promise<{ value?: T; error?: string }> {
  try {
    return { value: await executeHealthQuery<T>(db, query, label) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function probeTransaction<T extends Record<string, unknown>>(
  db: HealthDb,
  label: string,
  query: ReturnType<typeof sql>,
): Promise<{ value?: T; error?: string }> {
  try {
    const value = await withRetry(
      () => db.transaction(async (tx) => {
        const rows = await tx.execute<T>(query)
        return rows[0] as T | undefined
      }),
      {
        maxAttempts: 1,
        label,
        retryOnConnectionError: false,
        allowUncancelableTimeout: false,
      },
    )
    return { value }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export async function runDbConnectivityCheck(): Promise<DbHealth> {
  const started = Date.now()
  try {
    const { db } = getDbClient()
    const probeResult = await probe<{ ok: number }>(
      db,
      "health.connectivity",
      sql`select 1 as ok`,
    )
    const ok = probeResult.value?.ok === 1 && !probeResult.error
    return {
      ok,
      latencyMs: Date.now() - started,
      source: "db",
      ...(probeResult.error ? { error: probeResult.error } : {}),
      connectivity: {
        ok,
        latencyMs: Date.now() - started,
        ...(probeResult.error ? { error: probeResult.error } : {}),
      },
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      source: "db",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Raw DB health probe for routes and CLI scripts. It checks the settings that
 * matter for a realtime game server, not just whether a socket can execute
 * `SELECT 1`.
 */
export async function runDbHealthCheck(): Promise<DbHealth> {
  const started = Date.now()
  try {
    const { db } = getDbClient()
    const connectivityStarted = Date.now()
    const connectivity = await probe<{ ok: number }>(
      db,
      "health.connectivity",
      sql`select 1 as ok`,
    )
    const connectivityHealth = {
      ok: connectivity.value?.ok === 1 && !connectivity.error,
      latencyMs: Date.now() - connectivityStarted,
      ...(connectivity.error ? { error: connectivity.error } : {}),
    }

    const [timeoutProbe, effectiveTimeoutProbe, postgisProbe, migrationTableProbe, realtimeProbe] =
      await Promise.all([
        probe<{ statement_timeout: string }>(
          db,
          "health.statement_timeout",
          sql`select current_setting('statement_timeout') as statement_timeout`,
        ),
        probeTransaction<{ statement_timeout: string }>(
          db,
          "health.statement_timeout_effective",
          sql`select current_setting('statement_timeout') as statement_timeout`,
        ),
        probe<{ version: string | null }>(
          db,
          "health.postgis",
          sql`select extversion as version from pg_extension where extname = 'postgis'`,
        ),
        probe<{ table_present: boolean }>(
          db,
          "health.migration_table",
          sql`
            select exists(
              select 1
              from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'public'
                and c.relname = 'schema_migrations'
                and c.relkind = 'r'
            ) as table_present
          `,
        ),
        probe<{ signal_enabled: boolean }>(
          db,
          "health.realtime",
          sql`
            select exists(
              select 1
              from pg_publication p
              join pg_publication_rel pr on pr.prpubid = p.oid
              join pg_class c on c.oid = pr.prrelid
              join pg_namespace n on n.oid = c.relnamespace
              where p.pubname = 'supabase_realtime'
                and n.nspname = 'public'
                and c.relname = 'game_realtime_signals'
            ) as signal_enabled
          `,
        ),
      ])

    const serverDefaultValue = timeoutProbe.value?.statement_timeout ?? null
    const serverValue = effectiveTimeoutProbe.value?.statement_timeout ?? null
    const actualMs = serverValue === null ? null : parsePostgresDurationMs(serverValue)
    const serverDefaultMs =
      serverDefaultValue === null ? null : parsePostgresDurationMs(serverDefaultValue)
    const statementTimeout = {
      ok: actualMs === dbRuntimeConfig.statementTimeoutMs,
      configuredMs: dbRuntimeConfig.statementTimeoutMs,
      actualMs,
      serverValue,
      serverDefaultValue,
      serverDefaultOk: !timeoutProbe.error && serverDefaultMs === dbRuntimeConfig.statementTimeoutMs,
      ...(effectiveTimeoutProbe.error ? { error: effectiveTimeoutProbe.error } : {}),
    }
    if (effectiveTimeoutProbe.error) statementTimeout.ok = false

    const postgis = {
      ok: Boolean(postgisProbe.value?.version) && !postgisProbe.error,
      version: postgisProbe.value?.version ?? null,
      ...(postgisProbe.error ? { error: postgisProbe.error } : {}),
    }

    let migrationVersion: string | null = null
    let migrationError = migrationTableProbe.error
    const tablePresent = migrationTableProbe.value?.table_present === true
    if (tablePresent && !migrationError) {
      const versionProbe = await probe<{ id: string }>(
        db,
        "health.migration_version",
        sql`select id from public.schema_migrations order by applied_at desc, id desc limit 1`,
      )
      migrationVersion = versionProbe.value?.id ?? null
      migrationError = versionProbe.error
    }
    const expectedMigrationId = getExpectedMigrationId()
    const migration = {
      ok:
        tablePresent &&
        migrationVersion === expectedMigrationId &&
        !migrationError,
      expected: expectedMigrationId,
      actual: migrationVersion,
      tablePresent,
      ...(migrationError ? { error: migrationError } : {}),
    }

    const realtime = {
      ok: realtimeProbe.value?.signal_enabled === true && !realtimeProbe.error,
      publication: "supabase_realtime",
      signalTable: "public.game_realtime_signals",
      ...(realtimeProbe.error ? { error: realtimeProbe.error } : {}),
    }

    const components = [
      connectivityHealth,
      statementTimeout,
      postgis,
      migration,
      realtime,
    ]
    const errors = components
      .filter((component) => !component.ok && component.error)
      .map((component) => component.error)
    return {
      ok: components.every((component) => component.ok),
      latencyMs: Date.now() - started,
      source: "db",
      ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
      connectivity: connectivityHealth,
      statementTimeout,
      postgis,
      migration,
      realtime,
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      source: "db",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** Cached wrapper for the HTTP health route. CLI callers must use the raw probe. */
export async function checkDbHealth(): Promise<DbHealth> {
  "use cache"
  cacheTag("db-health")
  cacheLife(HEALTH_CACHE_LIFE)
  return runDbHealthCheck()
}
