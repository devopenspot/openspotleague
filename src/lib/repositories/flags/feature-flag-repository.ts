import type { FlagOverride } from "@/lib/flags/definition"

export interface UpsertFlagOverrideInput {
  key: string
  enabled: boolean
  rolloutPercent: number
  allowUserIds: readonly string[]
  allowRoles: readonly string[]
  updatedBy: string
}

export interface FeatureFlagRepository {
  listOverrides(): Promise<FlagOverride[]>
  upsertOverride(input: UpsertFlagOverrideInput): Promise<FlagOverride>
  deleteOverride(key: string): Promise<boolean>
}
