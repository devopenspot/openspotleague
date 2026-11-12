import type { AppEnvironment } from "@/lib/config/env"
import type { FlagDefinition, FlagOverride, FlagSubject } from "./definition"

/**
 * Stable bucket 0–99 for a user and flag (32-bit FNV-1a). The same user
 * always lands in the same bucket for a flag, and different flags spread
 * users differently, so raising the percentage only ever adds users.
 */
export function rolloutBucket(flagKey: string, userId: string): number {
  let hash = 0x811c9dc5
  const input = `${flagKey}:${userId}`
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % 100
}

/**
 * docs/feature-flags.md → "How a flag works":
 * no override → the code default for this environment; override off → off
 * for everyone; override on → allow-listed users and roles, then
 * `rolloutPercent` % of the remaining signed-in users (anonymous visitors
 * only at 100 %).
 */
export function evaluateFlag(
  key: string,
  definition: FlagDefinition,
  override: FlagOverride | undefined,
  appEnv: AppEnvironment,
  subject: FlagSubject = {},
): boolean {
  if (!override) return definition.defaults[appEnv]
  if (!override.enabled) return false
  const userId = subject.userId ?? null
  if (userId && override.allowUserIds.includes(userId)) return true
  if (override.allowRoles.length > 0 && subject.roles) {
    for (const role of subject.roles) if (override.allowRoles.includes(role)) return true
  }
  if (override.rolloutPercent >= 100) return true
  if (override.rolloutPercent <= 0 || !userId) return false
  return rolloutBucket(key, userId) < override.rolloutPercent
}
