import { type drizzle } from "drizzle-orm/postgres-js"
import { contentAuditLog } from "@/db/schema"

type Db = ReturnType<typeof drizzle>
type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0]
type AuditDb = Db | DbTransaction

export type ContentAuditEntityType = "spot" | "event" | "trick" | "tv_video"
export type ContentAuditAction = "create" | "update" | "delete"

export type AuditJson = Record<string, unknown> | readonly unknown[]

export interface ContentAuditInput {
  actorId?: string | null
  entityType: ContentAuditEntityType
  entityId: string
  disciplineSlug?: string | null
  action: ContentAuditAction
  before: AuditJson | null
  after: AuditJson | null
  metadata?: Record<string, unknown>
}

export function toAuditJson(value: unknown): AuditJson {
  return JSON.parse(JSON.stringify(value)) as AuditJson
}

export async function recordContentAudit(
  db: AuditDb,
  input: ContentAuditInput,
): Promise<void> {
  await db.insert(contentAuditLog).values({
    actorId: input.actorId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    disciplineSlug: input.disciplineSlug ?? null,
    action: input.action,
    before: input.before,
    after: input.after,
    metadata: input.metadata ?? {},
  })
}
