import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { env, getDatabaseUrl } from "@/lib/config/env";
import { log } from "@/lib/utils/log";
import * as schema from "@/db/schema";
import {
  getGlobalDbConcurrencySnapshot,
  withGlobalDbConcurrency,
} from "@/lib/db/concurrency";
import { getRequestCorrelationId } from "@/lib/db/request-context";
import { runWithDeferredCacheInvalidation } from "@/lib/cache/deferred";
import { collectErrorCodes, collectErrorMessages } from "./error-collect";
import { TimeoutError } from "./errors";
import { getPostgresOptions } from "./postgres-options";

export { TimeoutError };

type DbClient = ReturnType<typeof postgres>;
type Db = ReturnType<typeof drizzle<typeof schema>>;
type DbState = { client: DbClient; db: Db };

const globalForDb = globalThis as typeof globalThis & {
  __openspotDb?: DbState;
};

// Vercel Fluid Compute can run concurrent invocations in one warm instance,
// so one connection can become a local bottleneck. Keep this configurable,
// but bounded because every warm instance can create its own client pool.
const POOL_MAX = env.DB_POOL_MAX ?? (env.NODE_ENV === "production" ? 3 : 5);
const CONCURRENCY_MAX = Math.min(env.DB_CONCURRENCY_MAX ?? POOL_MAX, POOL_MAX);

// Tightened from 8s. If a connect takes >5s the network or DNS is
// broken; retrying with backoff is faster than waiting.
const CONNECT_TIMEOUT_SECONDS = env.DB_CONNECT_TIMEOUT_SECONDS ?? 5;
const IDLE_TIMEOUT_SECONDS = env.DB_IDLE_TIMEOUT_SECONDS ?? 5;
// Rotate well before pgBouncer's `server_idle_timeout` (600s on
// Supabase Transaction mode). A connection held idle past that returns
// 57014 on its next query — see `isConnectionError` below. 240s
// gives a 2.5x safety margin against clock drift between client
// and pooler.
const CONNECTION_LIFETIME_SECONDS = env.DB_MAX_LIFETIME_SECONDS ?? 240;
// postgres.js and PostgreSQL express this connection parameter in
// milliseconds. Keep the unit in the setting name so `8` cannot silently
// become an 8ms production timeout again.
const STATEMENT_TIMEOUT_MS = env.DB_STATEMENT_TIMEOUT_MS ?? 8_000;

// Client-side budget for a full `withDbRetry` operation (3 attempts max).
// Per-attempt deadline is the server `statement_timeout` (8s) plus the
// `SET LOCAL` at `src/lib/db/client.ts:72` — the server kills a slow
// query at 8s. The 15s budget here envelopes retries + jitter while
// letting the server win per-statement. For reads `allowUncancelableTimeout`
// is false (see `withDbRetry` below) so only cancelable postgres.js
// promises use the client timeout; writes rely on the server timeout.
const DEFAULT_DB_TIMEOUT_MS = env.DB_OPERATION_TIMEOUT_MS ?? 15_000;

// Per-attempt deadline for a checkout retry. When a checkout
// surfaces a transient error (ECONNRESET, EPIPE, socket hang up),
// we re-attempt the checkout up to `POOL_CHECKOUT_MAX_ATTEMPTS`
// times with jittered backoff, bounded by this deadline.
const POOL_CHECKOUT_TIMEOUT_MS = env.DB_POOL_CHECKOUT_TIMEOUT_MS ?? 3_000;
const POOL_CHECKOUT_MAX_ATTEMPTS = env.DB_POOL_CHECKOUT_MAX_ATTEMPTS ?? 3;

export const dbRuntimeConfig = {
  poolMax: POOL_MAX,
  concurrencyMax: CONCURRENCY_MAX,
  idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
  connectTimeoutSeconds: CONNECT_TIMEOUT_SECONDS,
  maxLifetimeSeconds: CONNECTION_LIFETIME_SECONDS,
  statementTimeoutMs: STATEMENT_TIMEOUT_MS,
  operationTimeoutMs: DEFAULT_DB_TIMEOUT_MS,
  poolCheckoutTimeoutMs: POOL_CHECKOUT_TIMEOUT_MS,
  poolCheckoutMaxAttempts: POOL_CHECKOUT_MAX_ATTEMPTS,
} as const;

type TransactionScope = {
  execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown>;
};

function statementTimeoutQuery() {
  return sql.raw(
    `set local statement_timeout = '${STATEMENT_TIMEOUT_MS}ms'`,
  );
}

function instrumentDb(rawDb: Db): Db {
  return new Proxy(rawDb, {
    get(target, property, receiver) {
      if (property !== "transaction") {
        return Reflect.get(target, property, receiver);
      }

      const transaction = Reflect.get(target, property, target) as (
        callback: (tx: TransactionScope) => Promise<unknown>,
        config?: unknown,
      ) => Promise<unknown>;
      return (callback: (tx: TransactionScope) => Promise<unknown>, config?: unknown) =>
        transaction.call(target, async (tx) => {
          await tx.execute(statementTimeoutQuery());
          return callback(tx);
        }, config);
    },
  }) as Db;
}

/**
 * Walks an error's `cause` chain and returns every message joined
 * with newlines. Drizzle wraps the underlying `postgres-js` error
 * (which in turn wraps the libpq error), so the libpq vocabulary we
 * match on — `57014 canceling statement due to statement timeout`,
 * `Connection terminated`, etc. — is only visible at
 * `err.cause.message`, not at the top level. Without this walk,
 * `isConnectionError` would misclassify every wrapped error as
 * non-retryable and `withDbRetry` would never engage.
 *
 * Bounded to 10 hops so a malformed cycle can't hang the caller.
 */
export type DatabaseErrorClass =
  | "connection"
  | "timeout"
  | "serialization"
  | "deadlock"
  | "constraint"
  | "authorization"
  | "validation"
  | "unknown";

export function classifyDatabaseError(err: unknown): DatabaseErrorClass {
  const message = collectErrorMessages(err).toLowerCase();
  const codes = new Set(collectErrorCodes(err));

  if (
    codes.has("CONNECT_TIMEOUT") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("connect timed out")
  ) {
    return "connection";
  }
  if (
    err instanceof TimeoutError ||
    codes.has("57014") ||
    message.includes("statement timeout") ||
    message.includes("query_canceled") ||
    message.includes("timed out")
  ) {
    return "timeout";
  }
  if (codes.has("40001") || message.includes("could not serialize")) {
    return "serialization";
  }
  if (codes.has("40P01") || message.includes("deadlock detected")) {
    return "deadlock";
  }
  if (
    [...codes].some((code) => code.startsWith("23")) ||
    message.includes("duplicate key") ||
    message.includes("constraint")
  ) {
    return "constraint";
  }
  if (
    [...codes].some((code) =>
      ["28000", "28P01", "42501"].includes(code),
    ) ||
    message.includes("authentication failed") ||
    message.includes("permission denied") ||
    message.includes("not authorized")
  ) {
    return "authorization";
  }
  if (
    [...codes].some((code) => code.startsWith("22")) ||
    (err instanceof Error &&
      ["ZodError", "ValidationError", "GameDomainError"].includes(err.name))
  ) {
    return "validation";
  }
  if (
    [...codes].some((code) =>
      [
        "ECONNREFUSED",
        "ECONNRESET",
        "ENOTFOUND",
        "EPIPE",
        "ETIMEDOUT",
        "EHOSTUNREACH",
        "CONNECTION_DESTROYED",
        "CONNECTION_CLOSED",
        "CONNECTION_ENDED",
        "CONNECT_TIMEOUT",
      ].includes(code),
    ) ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("epipe") ||
    message.includes("etimedout") ||
    message.includes("ehostunreach") ||
    message.includes("socket hang up") ||
    message.includes("connection terminated") ||
    message.includes("connection reset") ||
    message.includes("timeout exceeded when trying to connect") ||
    message.includes("max clients reached") ||
    message.includes("emaxconnsession") ||
    message.includes("pool_size") ||
    message.includes("terminating connection")
  ) {
    return "connection";
  }
  return "unknown";
}

export function isConnectionError(err: unknown): boolean {
  return classifyDatabaseError(err) === "connection";
}

export interface PoolSnapshot {
  max: number;
  active: number;
  queued: number;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  label?: string;
  retryOnConnectionError?: boolean;
  allowUncancelableTimeout?: boolean;
}

export type DbOperationPromise<T> = PromiseLike<T> & {
  cancel?: () => void;
};

function poolSnapshot(): PoolSnapshot | null {
  if (!globalForDb.__openspotDb) return null;
  const concurrency = getGlobalDbConcurrencySnapshot(CONCURRENCY_MAX);
  return {
    max: POOL_MAX,
    active: concurrency.active,
    queued: concurrency.queued,
  };
}

/**
 * Wraps an async function in a timeout. If the function doesn't resolve
 * within `ms`, the returned promise rejects with a `TimeoutError`. The
 * When the returned promise exposes postgres-js' `.cancel()` method, the
 * query is cancelled before the timeout is reported to the caller.
 */
export async function withTimeout<T>(
  fn: () => DbOperationPromise<T>,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const operation = fn();
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        operation.cancel?.();
      } catch {
        // The deadline still needs to surface if cancellation itself fails.
      }
      reject(new TimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withRetry<T>(
  fn: () => DbOperationPromise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const timeoutMs = opts.timeoutMs;
  const label = opts.label ?? "db.operation";
  const retryOnConnectionError = opts.retryOnConnectionError ?? true;
  const allowUncancelableTimeout = opts.allowUncancelableTimeout ?? true;

  // The deadline starts before the first slot wait, so time queued behind the
  // global gate counts against the operation budget. Each attempt takes its
  // own slot; the backoff sleep between attempts runs outside the gate.
  const started = Date.now();
  const deadline = timeoutMs ? started + timeoutMs : null;
  const requestId = getRequestCorrelationId() ?? crypto.randomUUID();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const attemptStarted = Date.now();
    try {
      const result = await withGlobalDbConcurrency(
        CONCURRENCY_MAX,
        async () => {
          const remaining = deadline === null ? null : deadline - Date.now();
          if (remaining !== null && remaining <= 0) {
            throw new TimeoutError(timeoutMs ?? 0);
          }
          const operation = fn();
          const cancelable = typeof operation.cancel === "function";
          return remaining !== null && (cancelable || allowUncancelableTimeout)
            ? await withTimeout(() => operation, remaining)
            : await operation;
        },
        { waitTimeoutMs: deadline === null ? undefined : deadline - Date.now() },
      );
      log.info("db.operation", {
        label,
        requestId,
        ok: true,
        attempt,
        attempts: maxAttempts,
        durationMs: Date.now() - started,
        attemptDurationMs: Date.now() - attemptStarted,
        errorClass: null,
        poolCeiling: POOL_MAX,
        pool: poolSnapshot(),
      });
      return result;
    } catch (err) {
      lastError = err;
      const errorClass = classifyDatabaseError(err);
      const retryable =
        errorClass === "connection" && retryOnConnectionError;
      const finalAttempt = attempt === maxAttempts;
      const budgetExpired = deadline !== null && Date.now() >= deadline;
      if (!retryable || finalAttempt || budgetExpired) {
        log.warn("db.operation", {
          label,
          requestId,
          ok: false,
          attempt,
          attempts: maxAttempts,
          durationMs: Date.now() - started,
          attemptDurationMs: Date.now() - attemptStarted,
          timedOut: errorClass === "timeout",
          retryable,
          errorClass,
          errorType: err instanceof Error ? err.name : typeof err,
          poolCeiling: POOL_MAX,
          pool: poolSnapshot(),
        });
        throw err;
      }

      const cap = baseDelayMs * 2 ** (attempt - 1);
      const jitteredDelay = Math.floor(Math.random() * Math.max(1, cap));
      const delay =
        deadline === null
          ? jitteredDelay
          : Math.min(jitteredDelay, Math.max(0, deadline - Date.now()));
      log.warn("db.retry", {
        label,
        requestId,
        attempt,
        delayMs: delay,
        errorClass,
        poolCeiling: POOL_MAX,
        pool: poolSnapshot(),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

/**
 * The standard wrapper for one DB operation. Retries on transient
 * connection errors (pgBouncer teardown, dead sockets) up to three
 * attempts. Repository promises are not cancelable after Drizzle maps
 * their result, so their server-side `statement_timeout` is the query
 * deadline; only cancelable postgres.js promises use the client deadline.
 */
export function withDbRetry<T>(
  fn: () => DbOperationPromise<T>,
  label = "db.operation",
  opts: { retryOnConnectionError?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  return withRetry(fn, {
    maxAttempts: 3,
    baseDelayMs: 200,
    timeoutMs: opts.timeoutMs ?? DEFAULT_DB_TIMEOUT_MS,
    label,
    retryOnConnectionError: opts.retryOnConnectionError,
    allowUncancelableTimeout: false,
  });
}

/**
 * Wraps a pool checkout in a short retry loop. Use this when an
 * operation can fail at the checkout step (e.g. a half-closed socket
 * returned to the pool) rather than during the query itself. The
 * underlying driver doesn't always re-raise checkout errors as
 * connection errors, so this gives us a separate, fast retry path
 * that doesn't burn the full 15s `withDbRetry` budget on a
 * transitory pooler-side disconnect.
 */
export async function withPoolRetry<T>(
  fn: () => DbOperationPromise<T>,
  opts: { maxAttempts?: number; timeoutMs?: number; label?: string } = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? POOL_CHECKOUT_MAX_ATTEMPTS;
  const timeoutMs = opts.timeoutMs ?? POOL_CHECKOUT_TIMEOUT_MS;
  const label = opts.label ?? "db.pool_checkout";
  const started = Date.now();
  const requestId = getRequestCorrelationId() ?? crypto.randomUUID();
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Per-attempt slot; the slot wait shares the per-attempt deadline.
      const result = await withGlobalDbConcurrency(
        CONCURRENCY_MAX,
        () => withTimeout(fn, timeoutMs),
        { waitTimeoutMs: timeoutMs },
      );
      log.info("db.pool_checkout", {
        label,
        requestId,
        ok: true,
        attempt,
        attempts: maxAttempts,
        durationMs: Date.now() - started,
        errorClass: null,
        poolCeiling: POOL_MAX,
        pool: poolSnapshot(),
      });
      return result;
    } catch (err) {
      lastError = err;
      const errorClass = classifyDatabaseError(err);
      const retryable = errorClass === "connection";
      const finalAttempt = attempt === maxAttempts;
      if (!retryable || finalAttempt) {
        log.warn("db.pool_checkout", {
          label,
          requestId,
          ok: false,
          attempt,
          attempts: maxAttempts,
          durationMs: Date.now() - started,
          timedOut: errorClass === "timeout",
          retryable,
          errorClass,
          errorType: err instanceof Error ? err.name : typeof err,
          poolCeiling: POOL_MAX,
          pool: poolSnapshot(),
        });
        throw err;
      }
      const cap = 100 * 2 ** (attempt - 1);
      const delay = Math.floor(Math.random() * cap);
      log.warn("db.pool_retry", {
        label,
        requestId,
        attempt,
        delayMs: delay,
        errorClass,
        poolCeiling: POOL_MAX,
        pool: poolSnapshot(),
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export function getDbClient() {
  const existing = globalForDb.__openspotDb;
  if (existing) return existing;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "SUPABASE_DATABASE_URL or SUPABASE_DIRECT_URL is not configured",
    );
  }
  const options = getPostgresOptions("runtime", {
    max: POOL_MAX,
    statementTimeoutMs: STATEMENT_TIMEOUT_MS,
    connectTimeoutSeconds: CONNECT_TIMEOUT_SECONDS,
    idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS,
    maxLifetimeSeconds: CONNECTION_LIFETIME_SECONDS,
  });
  const client = postgres(url, {
    ...options,
    onclose: (connectionId) => {
      log.warn("db.connection.closed", {
        connectionId,
        poolCeiling: POOL_MAX,
      });
    },
  });
  const db = instrumentDb(drizzle(client, { schema }));
  const state = { db, client };
  globalForDb.__openspotDb = state;
  return state;
}

export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

export async function closeDb(): Promise<void> {
  const state = globalForDb.__openspotDb;
  if (state) {
    await state.client.end({ timeout: 5 });
    delete globalForDb.__openspotDb;
  }
}

/**
 * Pool ceiling for callers that want to bound the number of in-flight
 * DB operations in a single request to the pool size (e.g. as a
 * `withDbConcurrency` limit). Currently read by `src/db/pool-check-cli.ts`.
 */
export function getDbPoolMax(): number {
  return POOL_MAX;
}

export function getDbConcurrencyMax(): number {
  return CONCURRENCY_MAX;
}

export function withDbRead<T>(
  label: string,
  fn: () => DbOperationPromise<T>,
): Promise<T> {
  return withDbRetry(fn, label);
}

export function withDbWrite<T>(
  label: string,
  fn: () => DbOperationPromise<T>,
): Promise<T> {
  // Cache invalidations queued inside the write body are flushed after the
  // transaction commits (see src/lib/cache/deferred.ts).
  return runWithDeferredCacheInvalidation(() =>
    withDbRetry(fn, label, { retryOnConnectionError: false }),
  );
}
