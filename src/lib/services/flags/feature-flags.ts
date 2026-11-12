import { cacheLife, cacheTag } from "next/cache"
import { env, type AppEnvironment } from "@/lib/config/env"
import { queueTagRevalidate, runWithDeferredCacheInvalidation } from "@/lib/cache/deferred"
import { FEATURE_FLAG_CACHE_LIFE } from "@/lib/cache/lifetimes"
import type { FlagDefinition, FlagOverride, FlagSubject } from "@/lib/flags/definition"
import { evaluateFlag } from "@/lib/flags/evaluate"
import { FLAGS, type FlagKey } from "@/lib/flags/registry"
import { getFeatureFlagRepositoryAsync } from "@/lib/repositories"
import { getAuthorizationSnapshotCached } from "@/lib/services/profile/authorization"
import { log } from "@/lib/utils/log"

/**
 * Feature flags (docs/feature-flags.md). Server only: evaluate here and pass
 * the booleans to Client Components.
 *
 * All overrides are read with one query into the shared cache, so evaluating
 * a flag costs no database round trip per request; a toggle invalidates the
 * tag after it commits.
 */

export const FEATURE_FLAGS_TAG = "feature-flags"

const REGISTRY: Readonly<Record<string, FlagDefinition>> = FLAGS

export class FeatureFlagError extends Error {
  override name = "FeatureFlagError"
  constructor(
    public readonly code: "UNKNOWN_FLAG" | "INVALID_OVERRIDE",
    message: string,
  ) {
    super(message)
  }
}

async function readOverridesCached(): Promise<FlagOverride[]> {
  "use cache: remote"
  cacheTag(FEATURE_FLAGS_TAG)
  cacheLife(FEATURE_FLAG_CACHE_LIFE)
  const repo = await getFeatureFlagRepositoryAsync()
  return repo.listOverrides()
}

// Plain data only (no sockets or promises), so module scope is safe on Workers.
let lastGood: FlagOverride[] = []
let skipReadsUntil = 0
const FAILURE_BACKOFF_MS = 30_000

/**
 * Overrides by key. After a failed read, the last good rows (or the code
 * defaults) are used for 30 s without querying again, so a database incident
 * is not multiplied by every flag check.
 */
async function overridesByKey(): Promise<Map<string, FlagOverride>> {
  if (Date.now() >= skipReadsUntil) {
    try {
      lastGood = await readOverridesCached()
    } catch (error) {
      skipReadsUntil = Date.now() + FAILURE_BACKOFF_MS
      log.warn("feature_flags.read_failed", { error: error instanceof Error ? error.message : String(error) })
    }
  }
  return new Map(lastGood.map((row) => [row.key, row]))
}

/** Test hook: forget the last read and any backoff. */
export function resetFeatureFlagReadStateForTests(): void {
  lastGood = []
  skipReadsUntil = 0
}

function appEnvironment(): AppEnvironment {
  return env.APP_ENV
}

async function subjectWithRoles(subject: FlagSubject, needsRoles: boolean): Promise<FlagSubject> {
  if (!needsRoles || subject.roles || !subject.userId) return subject
  try {
    const snapshot = await getAuthorizationSnapshotCached(subject.userId)
    return { ...subject, roles: snapshot.roles }
  } catch {
    // Role targeting fails closed; percentage and allow-list still apply.
    return subject
  }
}

/** Whether `key` is on for this user in this environment. */
export async function isEnabled(key: FlagKey, subject: FlagSubject = {}): Promise<boolean> {
  const flags = await evaluateFlags([key], subject)
  return flags[key]
}

/** Evaluates several flags with one cached read. */
export async function evaluateFlags<K extends FlagKey>(
  keys: readonly K[],
  subject: FlagSubject = {},
): Promise<Record<K, boolean>> {
  const overrides = await overridesByKey()
  const needsRoles = keys.some((key) => (overrides.get(key)?.allowRoles.length ?? 0) > 0)
  const resolved = await subjectWithRoles(subject, needsRoles)
  const appEnv = appEnvironment()
  const result = {} as Record<K, boolean>
  for (const key of keys) {
    const definition = REGISTRY[key]
    result[key] = definition ? evaluateFlag(key, definition, overrides.get(key), appEnv, resolved) : false
  }
  return result
}

/** Admin projection: every declared flag with its default and override. */
export interface FlagState {
  key: string
  description: string
  owner: string
  removeBy: string
  defaultEnabled: boolean
  override: {
    enabled: boolean
    rolloutPercent: number
    allowUserIds: string[]
    allowRoles: string[]
    updatedBy: string | null
    updatedAt: string
  } | null
}

export async function listFlagStates(): Promise<FlagState[]> {
  const overrides = await overridesByKey()
  const appEnv = appEnvironment()
  return Object.entries(REGISTRY)
    .map(([key, definition]) => {
      const override = overrides.get(key)
      return {
        key,
        description: definition.description,
        owner: definition.owner,
        removeBy: definition.removeBy,
        defaultEnabled: definition.defaults[appEnv],
        override: override
          ? {
              enabled: override.enabled,
              rolloutPercent: override.rolloutPercent,
              allowUserIds: [...override.allowUserIds],
              allowRoles: [...override.allowRoles],
              updatedBy: override.updatedBy,
              updatedAt: override.updatedAt.toISOString(),
            }
          : null,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

export interface SetFlagOverrideInput {
  enabled: boolean
  rolloutPercent: number
  allowUserIds: string[]
  allowRoles: string[]
}

function assertKnown(key: string): void {
  if (!Object.prototype.hasOwnProperty.call(REGISTRY, key)) {
    throw new FeatureFlagError("UNKNOWN_FLAG", `Unknown flag "${key}". Declare it in src/lib/flags/registry.ts first.`)
  }
}

/** Sets this environment's override. Invalidates the cache after commit. */
export async function setFlagOverride(key: string, input: SetFlagOverrideInput, actorId: string): Promise<FlagOverride> {
  assertKnown(key)
  if (!Number.isInteger(input.rolloutPercent) || input.rolloutPercent < 0 || input.rolloutPercent > 100) {
    throw new FeatureFlagError("INVALID_OVERRIDE", "rolloutPercent must be an integer from 0 to 100.")
  }
  const repo = await getFeatureFlagRepositoryAsync()
  return runWithDeferredCacheInvalidation(async () => {
    const saved = await repo.upsertOverride({ key, ...input, updatedBy: actorId })
    queueTagRevalidate(FEATURE_FLAGS_TAG, FEATURE_FLAG_CACHE_LIFE)
    return saved
  })
}

/** Removes the override, so the code default applies again. */
export async function clearFlagOverride(key: string): Promise<boolean> {
  const repo = await getFeatureFlagRepositoryAsync()
  return runWithDeferredCacheInvalidation(async () => {
    const removed = await repo.deleteOverride(key)
    if (removed) queueTagRevalidate(FEATURE_FLAGS_TAG, FEATURE_FLAG_CACHE_LIFE)
    return removed
  })
}
