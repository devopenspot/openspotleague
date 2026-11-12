import { eq, sql } from "drizzle-orm"
import type { drizzle } from "drizzle-orm/postgres-js"
import { featureFlags, type FeatureFlagRow } from "@/db/schema"
import type { FlagOverride } from "@/lib/flags/definition"
import type { FeatureFlagRepository, UpsertFlagOverrideInput } from "./feature-flag-repository"

function toOverride(row: FeatureFlagRow): FlagOverride {
  return {
    key: row.key,
    enabled: row.enabled,
    rolloutPercent: row.rolloutPercent,
    allowUserIds: row.allowUserIds,
    allowRoles: row.allowRoles,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleFeatureFlagRepository implements FeatureFlagRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async listOverrides(): Promise<FlagOverride[]> {
    const rows = await this.db.select().from(featureFlags)
    return rows.map(toOverride)
  }

  async upsertOverride(input: UpsertFlagOverrideInput): Promise<FlagOverride> {
    const values = {
      enabled: input.enabled,
      rolloutPercent: input.rolloutPercent,
      allowUserIds: [...input.allowUserIds],
      allowRoles: [...input.allowRoles],
      updatedBy: input.updatedBy,
    }
    const [row] = await this.db
      .insert(featureFlags)
      .values({ key: input.key, ...values })
      .onConflictDoUpdate({ target: featureFlags.key, set: { ...values, updatedAt: sql`now()` } })
      .returning()
    if (!row) throw new Error("Failed to upsert feature flag override")
    return toOverride(row)
  }

  async deleteOverride(key: string): Promise<boolean> {
    const rows = await this.db.delete(featureFlags).where(eq(featureFlags.key, key)).returning({ key: featureFlags.key })
    return rows.length > 0
  }
}
