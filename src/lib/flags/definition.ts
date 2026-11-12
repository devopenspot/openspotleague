import type { AppEnvironment } from "@/lib/config/env"

/** A flag declared in src/lib/flags/registry.ts (docs/feature-flags.md). */
export interface FlagDefinition {
  description: string
  /** GitHub handle of whoever removes the flag. */
  owner: string
  /** ISO date (YYYY-MM-DD). A unit test fails after it, to force the cleanup. */
  removeBy: string
  defaults: Readonly<Record<AppEnvironment, boolean>>
}

export function defineFlag(definition: FlagDefinition): FlagDefinition {
  return definition
}

/** A database override, as the service reads it. */
export interface FlagOverride {
  key: string
  enabled: boolean
  rolloutPercent: number
  allowUserIds: readonly string[]
  allowRoles: readonly string[]
  updatedBy: string | null
  updatedAt: Date
}

/** Who is asking. Anonymous visitors have no userId. */
export interface FlagSubject {
  userId?: string | null
  roles?: Iterable<string>
}

export const FLAG_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{1,63}$/
