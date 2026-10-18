import { and, eq, type SQL } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import type { PgColumn, PgTable } from "drizzle-orm/pg-core"
import { StaleRecordError } from "./errors"
import { recordContentAudit, type ContentAuditEntityType } from "../admin/content-audit"

type Db = ReturnType<typeof drizzle>
type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0]
type OccDb = Db | DbTransaction

export type OccDeleteTable = PgTable & { id: PgColumn; updatedAt: PgColumn }

/**
 * Shared optimistic-concurrency delete for audited content entities.
 *
 * Flow: optional expected-updatedAt guard → conditional DELETE → audit row on
 * success → StaleRecordError when the row exists but the guard mismatched →
 * notFound when absent. Spot/event repository deletes are thin wrappers
 * around this.
 */
export async function deleteWithOccAudit(options: {
  db: OccDb
  table: OccDeleteTable
  id: string
  entityType: ContentAuditEntityType
  /** Parsed If-Match date; undefined/null means unconditional delete. */
  expectedDate?: Date | null
  actorId?: string | null
  disciplineSlug?: string | null
  before: Record<string, unknown> | null
  notFoundMessage: string
  /** Extra context stored on the audit row (defaults to `{}`). */
  metadata?: Record<string, unknown>
}): Promise<void> {
  const { db, table, id, entityType, expectedDate, actorId, disciplineSlug, before, notFoundMessage, metadata } = options

  const whereClause: SQL | undefined = expectedDate
    ? and(eq(table.id, id), eq(table.updatedAt, expectedDate))
    : eq(table.id, id)
  const result = await db.delete(table).where(whereClause).returning({ id: table.id })

  if (result.length > 0) {
    await recordContentAudit(db, {
      actorId,
      entityType,
      entityId: id,
      disciplineSlug: disciplineSlug ?? null,
      action: "delete",
      before,
      after: null,
      metadata,
    })
    return
  }

  if (expectedDate) {
    const [existing] = await db
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, id))
      .limit(1)
    if (existing) throw new StaleRecordError()
  }
  throw new Error(notFoundMessage)
}
