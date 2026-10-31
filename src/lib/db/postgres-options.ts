import type { Options as PostgresOptions } from "postgres";

import { env } from "@/lib/config/env";

const RUNTIME_STATEMENT_TIMEOUT_MS = env.DB_STATEMENT_TIMEOUT_MS ?? 8_000;
const RUNTIME_CONNECT_TIMEOUT_SECONDS = env.DB_CONNECT_TIMEOUT_SECONDS ?? 5;
const RUNTIME_IDLE_TIMEOUT_SECONDS = env.DB_IDLE_TIMEOUT_SECONDS ?? 5;
const RUNTIME_MAX_LIFETIME_SECONDS = env.DB_MAX_LIFETIME_SECONDS ?? 240;

export type PostgresPurpose = "runtime" | "ddl" | "script";

function jitteredLifetime(baseSeconds: number): number {
  // ±12.5% jitter (30s on 240s) desyncs warm Vercel isolates rotating at same instant
  const jitter = Math.floor(Math.random() * 61) - 30;
  return Math.max(30, baseSeconds + jitter);
}

export function getPostgresOptions(
  purpose: PostgresPurpose = "runtime",
  overrides: Partial<{
    max: number;
    statementTimeoutMs: number;
    connectTimeoutSeconds: number;
    idleTimeoutSeconds: number;
    maxLifetimeSeconds: number;
    hyperdrive: boolean;
  }> = {},
): PostgresOptions<Record<string, never>> {
  const max =
    overrides.max ??
    (purpose === "runtime"
      ? (env.DB_POOL_MAX ?? (env.NODE_ENV === "production" ? 3 : 5))
      : purpose === "ddl"
        ? 1
        : 2);

  const statementTimeoutMs =
    overrides.statementTimeoutMs ??
    (purpose === "ddl" ? 120_000 : RUNTIME_STATEMENT_TIMEOUT_MS);

  const connectTimeoutSeconds =
    overrides.connectTimeoutSeconds ??
    (purpose === "ddl" ? 10 : RUNTIME_CONNECT_TIMEOUT_SECONDS);

  const idleTimeoutSeconds =
    overrides.idleTimeoutSeconds ?? RUNTIME_IDLE_TIMEOUT_SECONDS;

  const maxLifetimeSeconds =
    overrides.maxLifetimeSeconds ?? RUNTIME_MAX_LIFETIME_SECONDS;

  return {
    // Hyperdrive's connection string decides TLS for the hop to its proxy.
    ...(overrides.hyperdrive ? {} : { ssl: "require" }),
    max,
    connect_timeout: connectTimeoutSeconds,
    idle_timeout: idleTimeoutSeconds,
    max_lifetime: jitteredLifetime(maxLifetimeSeconds),
    // Cloudflare warns that `prepare: false` can hang through Hyperdrive.
    // `fetch_types` stays on either way: the schema has `text[]` columns.
    prepare: overrides.hyperdrive === true,
    connection: {
      application_name: purpose === "runtime" ? "openspot" : `openspot-${purpose}`,
      statement_timeout: statementTimeoutMs,
    },
    onclose: undefined,
  } as PostgresOptions<Record<string, never>>;
}

export function getRuntimePostgresOptions(): PostgresOptions<Record<string, never>> {
  return getPostgresOptions("runtime");
}
