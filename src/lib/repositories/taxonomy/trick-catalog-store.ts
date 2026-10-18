import { createHash } from "node:crypto"
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import {
  challengeCatalogTricks,
  challengeCatalogs,
  challengeTrickSpotTypes,
  trickCatalogStates,
  trickDefinitionSpotTypes,
  trickDefinitions,
} from "@/db/schema"
import { GAME_DEFINITIONS } from "@/lib/games/definitions"
import type { DisciplineSlug } from "@/lib/schemas/game"
import type {
  TrickCatalog,
  TrickCatalogEntry,
  TrickMutationOptions,
} from "./taxonomy-repository"
import {
  InvalidConcurrencyTokenError,
  StaleRecordError,
} from "../core/errors"
import { recordContentAudit, toAuditJson } from "../admin/content-audit"

type Db = ReturnType<typeof drizzle>
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

type CanonicalTrick = TrickCatalogEntry & { id: string }

function definitionFor(disciplineSlug: string) {
  const definition = GAME_DEFINITIONS[disciplineSlug as DisciplineSlug]
  if (!definition || definition.disciplineSlug !== disciplineSlug) {
    throw new Error(`Unsupported discipline: ${disciplineSlug}`)
  }
  return definition
}

export function normalizeTrick(trick: TrickCatalogEntry): TrickCatalogEntry {
  return {
    sourceId: trick.sourceId.trim(),
    name: trick.name.trim(),
    description: trick.description.trim(),
    level: trick.level,
    compatibleSpotTypes: [...new Set(trick.compatibleSpotTypes.map((slug) => slug.trim().toLowerCase()))].sort(),
    categories: [...new Set((trick.categories ?? []).map((c) => c.trim().toLowerCase()).filter((c) => c.length > 0))].sort(),
  }
}

export function selectMissingCanonicalTricks(
  existingSourceIds: ReadonlySet<string>,
  input: readonly TrickCatalogEntry[],
): readonly TrickCatalogEntry[] {
  const seen = new Set(existingSourceIds)
  const missing: TrickCatalogEntry[] = []
  for (const trick of input.map(normalizeTrick)) {
    if (seen.has(trick.sourceId)) continue
    seen.add(trick.sourceId)
    missing.push(trick)
  }
  return missing
}

function sameTrick(left: TrickCatalogEntry, right: TrickCatalogEntry): boolean {
  const normalizedLeft = normalizeTrick(left)
  const normalizedRight = normalizeTrick(right)
  return normalizedLeft.sourceId === normalizedRight.sourceId
    && normalizedLeft.name === normalizedRight.name
    && normalizedLeft.description === normalizedRight.description
    && normalizedLeft.level === normalizedRight.level
    && normalizedLeft.compatibleSpotTypes.length === normalizedRight.compatibleSpotTypes.length
    && normalizedLeft.compatibleSpotTypes.every(
      (slug, index) => slug === normalizedRight.compatibleSpotTypes[index],
    )
    && normalizedLeft.categories.length === normalizedRight.categories.length
    && normalizedLeft.categories.every((cat, index) => cat === normalizedRight.categories[index])
}

function parseExpectedUpdatedAt(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    throw new InvalidConcurrencyTokenError()
  }
  return parsed
}

function assertExpectedUpdatedAt(current: Date, expected: string | undefined): void {
  const expectedDate = parseExpectedUpdatedAt(expected)
  if (expectedDate && current.getTime() !== expectedDate.getTime()) {
    throw new StaleRecordError()
  }
}

async function ensureCatalogState(tx: Tx, disciplineSlug: string) {
  definitionFor(disciplineSlug)
  await tx
    .insert(trickCatalogStates)
    .values({ disciplineSlug })
    .onConflictDoNothing({ target: trickCatalogStates.disciplineSlug })
  const [state] = await tx
    .select()
    .from(trickCatalogStates)
    .where(eq(trickCatalogStates.disciplineSlug, disciplineSlug))
    .for("update")
  if (!state) throw new Error(`Trick catalog state not found: ${disciplineSlug}`)
  return state
}

async function readCatalogState(tx: Db | Tx, disciplineSlug: string) {
  definitionFor(disciplineSlug)
  const [state] = await tx
    .select()
    .from(trickCatalogStates)
    .where(eq(trickCatalogStates.disciplineSlug, disciplineSlug))
  if (!state) throw new Error(`Trick catalog state not found: ${disciplineSlug}`)
  return state
}

async function canonicalTricks(tx: Db | Tx, disciplineSlug: string): Promise<CanonicalTrick[]> {
  const rows = await tx
    .select({
      id: trickDefinitions.id,
      sourceId: trickDefinitions.sourceId,
      name: trickDefinitions.name,
      description: trickDefinitions.description,
      level: trickDefinitions.level,
      categories: trickDefinitions.categories,
    })
    .from(trickDefinitions)
    .where(eq(trickDefinitions.disciplineSlug, disciplineSlug))
    .orderBy(
      asc(trickDefinitions.level),
      asc(trickDefinitions.name),
      asc(trickDefinitions.sourceId),
    )

  if (rows.length === 0) return []
  const compatibility = await tx
    .select({ trickId: trickDefinitionSpotTypes.trickId, slug: trickDefinitionSpotTypes.spotTypeSlug })
    .from(trickDefinitionSpotTypes)
    .where(inArray(trickDefinitionSpotTypes.trickId, rows.map((row) => row.id)))
    .orderBy(asc(trickDefinitionSpotTypes.spotTypeSlug))
  const compatibilityByTrick = new Map<string, string[]>()
  for (const row of compatibility) {
    compatibilityByTrick.set(row.trickId, [
      ...(compatibilityByTrick.get(row.trickId) ?? []),
      row.slug,
    ])
  }

  return rows.map((row) => {
    const rawCats = (row.categories as readonly string[] | null) ?? []
    const normalizedCats = [...new Set(rawCats.map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0))].sort()
    return {
      sourceId: row.sourceId,
      name: row.name,
      description: row.description,
      level: row.level as 1 | 2 | 3 | 4 | 5,
      compatibleSpotTypes: compatibilityByTrick.get(row.id) ?? [],
      categories: normalizedCats,
      id: row.id,
    }
  })
}

function publicCatalog(
  disciplineSlug: string,
  tricks: readonly CanonicalTrick[],
  createdAt: Date,
  version: number,
): TrickCatalog {
  const definition = definitionFor(disciplineSlug)
  return {
    disciplineSlug,
    challengeKey: definition.challengeKey,
    gameName: definition.gameName,
    eliminationWord: definition.eliminationWord,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    version,
    tricks: tricks.map(({ id: _id, ...trick }) => trick),
  }
}

function canonicalHash(disciplineSlug: string, tricks: readonly CanonicalTrick[]): string {
  const canonical = {
    discipline: disciplineSlug,
    tricks: [...tricks].sort((left, right) => left.sourceId.localeCompare(right.sourceId)).map((trick) => ({
      id: trick.sourceId,
      name: trick.name,
      description: trick.description,
      level: trick.level,
      discipline: disciplineSlug,
      compatibleSpotTypes: [...trick.compatibleSpotTypes].sort(),
      categories: [...(trick.categories ?? [])].sort(),
    })),
  }
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex")
}

export async function readCurrentTrickCatalog(tx: Db | Tx, disciplineSlug: string): Promise<TrickCatalog> {
  const [state, tricks] = await Promise.all([
    readCatalogState(tx, disciplineSlug),
    canonicalTricks(tx, disciplineSlug),
  ])
  return publicCatalog(
    disciplineSlug,
    tricks,
    state.updatedAt,
    state.version,
  )
}

export async function listCurrentTrickCatalogs(db: Db): Promise<readonly TrickCatalog[]> {
  const states = await db
    .select()
    .from(trickCatalogStates)
    .orderBy(asc(trickCatalogStates.disciplineSlug))
  if (states.length === 0) return []

  const disciplineSlugs = states.map((state) => state.disciplineSlug)
  const rows = await db
    .select({
      id: trickDefinitions.id,
      disciplineSlug: trickDefinitions.disciplineSlug,
      sourceId: trickDefinitions.sourceId,
      name: trickDefinitions.name,
      description: trickDefinitions.description,
      level: trickDefinitions.level,
      categories: trickDefinitions.categories,
    })
    .from(trickDefinitions)
    .where(inArray(trickDefinitions.disciplineSlug, disciplineSlugs))
    .orderBy(
      asc(trickDefinitions.disciplineSlug),
      asc(trickDefinitions.level),
      asc(trickDefinitions.name),
      asc(trickDefinitions.sourceId),
    )
  const compatibility = rows.length === 0
    ? []
    : await db
      .select({ trickId: trickDefinitionSpotTypes.trickId, slug: trickDefinitionSpotTypes.spotTypeSlug })
      .from(trickDefinitionSpotTypes)
      .where(inArray(trickDefinitionSpotTypes.trickId, rows.map((row) => row.id)))
      .orderBy(asc(trickDefinitionSpotTypes.spotTypeSlug))
  const compatibilityByTrick = new Map<string, string[]>()
  for (const row of compatibility) {
    compatibilityByTrick.set(row.trickId, [
      ...(compatibilityByTrick.get(row.trickId) ?? []),
      row.slug,
    ])
  }

  return states.map((state) => publicCatalog(
    state.disciplineSlug,
    rows
      .filter((row) => row.disciplineSlug === state.disciplineSlug)
      .map((row) => {
        const rawCats = (row.categories as readonly string[] | null) ?? []
        const cats = [...new Set(rawCats.map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0))].sort()
        return {
          sourceId: row.sourceId,
          name: row.name,
          description: row.description,
          level: row.level as 1 | 2 | 3 | 4 | 5,
          compatibleSpotTypes: compatibilityByTrick.get(row.id) ?? [],
          categories: cats,
          id: row.id,
        }
      }),
    state.updatedAt,
    state.version,
  ))
}

export async function saveCanonicalTrick(
  db: Db,
  disciplineSlug: string,
  input: TrickCatalogEntry,
  options: TrickMutationOptions = {},
): Promise<TrickCatalogEntry> {
  const normalized = normalizeTrick(input)
  if (normalized.compatibleSpotTypes.length === 0) {
    throw new Error("A trick must support at least one spot type")
  }

  return db.transaction(async (tx) => {
    const state = await ensureCatalogState(tx, disciplineSlug)
    assertExpectedUpdatedAt(state.updatedAt, options.expectedUpdatedAt)
    const [existing] = await tx
      .select({
        id: trickDefinitions.id,
        sourceId: trickDefinitions.sourceId,
        name: trickDefinitions.name,
        description: trickDefinitions.description,
        level: trickDefinitions.level,
        categories: trickDefinitions.categories,
      })
      .from(trickDefinitions)
      .where(and(
        eq(trickDefinitions.disciplineSlug, disciplineSlug),
        eq(trickDefinitions.sourceId, normalized.sourceId),
      ))
      .for("update")

    const currentCompatibility = existing
      ? await tx
        .select({ slug: trickDefinitionSpotTypes.spotTypeSlug })
        .from(trickDefinitionSpotTypes)
        .where(eq(trickDefinitionSpotTypes.trickId, existing.id))
        .orderBy(asc(trickDefinitionSpotTypes.spotTypeSlug))
      : []
    const current = existing
      ? {
          sourceId: existing.sourceId,
          name: existing.name,
          description: existing.description,
          level: existing.level as 1 | 2 | 3 | 4 | 5,
          compatibleSpotTypes: currentCompatibility.map((row) => row.slug),
          categories: [...new Set(((existing.categories as readonly string[] | null) ?? []).map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0))].sort(),
        }
      : null
    if (current && sameTrick(current, normalized)) return normalized

    const trickId = existing
      ? existing.id
      : (await tx
        .insert(trickDefinitions)
        .values({
          disciplineSlug,
          sourceId: normalized.sourceId,
          name: normalized.name,
          description: normalized.description,
          level: normalized.level,
          categories: [...normalized.categories],
          updatedBy: options.actorId ?? null,
        })
        .returning({ id: trickDefinitions.id }))[0]?.id
    if (!trickId) throw new Error("Trick could not be created")

    if (existing) {
      await tx
        .update(trickDefinitions)
        .set({
          name: normalized.name,
          description: normalized.description,
          level: normalized.level,
          categories: [...normalized.categories],
          updatedAt: new Date(),
          ...(options.actorId !== undefined ? { updatedBy: options.actorId } : {}),
        })
        .where(eq(trickDefinitions.id, trickId))
      await tx
        .delete(trickDefinitionSpotTypes)
        .where(eq(trickDefinitionSpotTypes.trickId, trickId))
    }
    await tx
      .insert(trickDefinitionSpotTypes)
      .values(normalized.compatibleSpotTypes.map((spotTypeSlug) => ({ trickId, spotTypeSlug })))
    const stateUpdate = {
      version: sql`${trickCatalogStates.version} + 1`,
      updatedAt: new Date(),
      ...(options.actorId !== undefined ? { updatedBy: options.actorId } : {}),
    }
    await tx
      .update(trickCatalogStates)
      .set(stateUpdate)
      .where(eq(trickCatalogStates.disciplineSlug, disciplineSlug))
    await recordContentAudit(tx, {
      actorId: options.actorId,
      entityType: "trick",
      entityId: trickId,
      disciplineSlug,
      action: existing ? "update" : "create",
      before: current ? toAuditJson(current) : null,
      after: toAuditJson(normalized),
    })
    return normalized
  })
}

export async function deleteCanonicalTrick(
  db: Db,
  disciplineSlug: string,
  sourceId: string,
  options: TrickMutationOptions = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    const state = await ensureCatalogState(tx, disciplineSlug)
    assertExpectedUpdatedAt(state.updatedAt, options.expectedUpdatedAt)
    const [existing] = await tx
      .select({ id: trickDefinitions.id })
      .from(trickDefinitions)
      .where(and(
        eq(trickDefinitions.disciplineSlug, disciplineSlug),
        eq(trickDefinitions.sourceId, sourceId),
      ))
      .for("update")
    if (!existing) throw new Error(`Trick not found: ${sourceId}`)

    const compatibility = await tx
      .select({ slug: trickDefinitionSpotTypes.spotTypeSlug })
      .from(trickDefinitionSpotTypes)
      .where(eq(trickDefinitionSpotTypes.trickId, existing.id))
      .orderBy(asc(trickDefinitionSpotTypes.spotTypeSlug))
    const [before] = await tx
      .select({
        sourceId: trickDefinitions.sourceId,
        name: trickDefinitions.name,
        description: trickDefinitions.description,
        level: trickDefinitions.level,
        categories: trickDefinitions.categories,
      })
      .from(trickDefinitions)
      .where(eq(trickDefinitions.id, existing.id))
      .limit(1)

    const remaining = await tx
      .select({ id: trickDefinitions.id })
      .from(trickDefinitions)
      .where(eq(trickDefinitions.disciplineSlug, disciplineSlug))
      .limit(2)
    if (remaining.length <= 1) throw new Error("A catalog must contain at least one trick")

    await tx.delete(trickDefinitions).where(eq(trickDefinitions.id, existing.id))
    const stateUpdate = {
      version: sql`${trickCatalogStates.version} + 1`,
      updatedAt: new Date(),
      ...(options.actorId !== undefined ? { updatedBy: options.actorId } : {}),
    }
    await tx
      .update(trickCatalogStates)
      .set(stateUpdate)
      .where(eq(trickCatalogStates.disciplineSlug, disciplineSlug))
    await recordContentAudit(tx, {
      actorId: options.actorId,
      entityType: "trick",
      entityId: existing.id,
      disciplineSlug,
      action: "delete",
      before: before
        ? toAuditJson({
            ...before,
            categories: [...new Set(((before.categories as readonly string[] | null) ?? []).map((c) => String(c).trim().toLowerCase()).filter((c) => c.length > 0))].sort(),
            compatibleSpotTypes: compatibility.map((row) => row.slug),
          })
        : null,
      after: null,
    })
  })
}

export async function addCanonicalTricks(
  db: Db,
  disciplineSlug: string,
  input: readonly TrickCatalogEntry[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await ensureCatalogState(tx, disciplineSlug)
    const existing = await tx
      .select({ sourceId: trickDefinitions.sourceId })
      .from(trickDefinitions)
      .where(eq(trickDefinitions.disciplineSlug, disciplineSlug))
    const missing = selectMissingCanonicalTricks(
      new Set(existing.map((trick) => trick.sourceId)),
      input,
    )
    if (missing.length === 0) return

    const inserted = await tx
      .insert(trickDefinitions)
      .values(missing.map((trick) => ({
        disciplineSlug,
        sourceId: trick.sourceId,
        name: trick.name,
        description: trick.description,
        level: trick.level,
        categories: [...trick.categories],
      })))
      .onConflictDoNothing()
      .returning({ id: trickDefinitions.id, sourceId: trickDefinitions.sourceId })
    if (inserted.length === 0) return

    const bySourceId = new Map(missing.map((trick) => [trick.sourceId, trick]))
    const compatibility = inserted.flatMap((row) =>
      (bySourceId.get(row.sourceId)?.compatibleSpotTypes ?? []).map((spotTypeSlug) => ({
        trickId: row.id,
        spotTypeSlug,
      })),
    )
    if (compatibility.length > 0) {
      await tx.insert(trickDefinitionSpotTypes).values(compatibility).onConflictDoNothing()
    }
    await tx
      .update(trickCatalogStates)
      .set({ version: sql`${trickCatalogStates.version} + 1`, updatedAt: new Date() })
      .where(eq(trickCatalogStates.disciplineSlug, disciplineSlug))
  })
}

export async function replaceCanonicalTricks(
  db: Db,
  disciplineSlug: string,
  input: readonly TrickCatalogEntry[],
): Promise<void> {
  const normalized = input.map(normalizeTrick)
  await db.transaction(async (tx) => {
    await ensureCatalogState(tx, disciplineSlug)
    const inserted = normalized.length === 0
      ? []
      : await tx
        .insert(trickDefinitions)
        .values(normalized.map((trick) => ({
          disciplineSlug,
          sourceId: trick.sourceId,
          name: trick.name,
          description: trick.description,
          level: trick.level,
          categories: [...trick.categories],
        })))
        .onConflictDoUpdate({
          target: [trickDefinitions.disciplineSlug, trickDefinitions.sourceId],
          set: {
            name: sql`excluded.name`,
            description: sql`excluded.description`,
            level: sql`excluded.level`,
            categories: sql`excluded.categories`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: trickDefinitions.id, sourceId: trickDefinitions.sourceId })
    const ids = inserted.map((row) => row.id)
    if (ids.length > 0) {
      await tx.delete(trickDefinitionSpotTypes).where(inArray(trickDefinitionSpotTypes.trickId, ids))
      const bySourceId = new Map(normalized.map((trick) => [trick.sourceId, trick]))
      const compatibility = inserted.flatMap((row) =>
        (bySourceId.get(row.sourceId)?.compatibleSpotTypes ?? []).map((spotTypeSlug) => ({
          trickId: row.id,
          spotTypeSlug,
        })),
      )
      if (compatibility.length > 0) await tx.insert(trickDefinitionSpotTypes).values(compatibility)
    }
    if (normalized.length > 0) {
      await tx
        .delete(trickDefinitions)
        .where(and(
          eq(trickDefinitions.disciplineSlug, disciplineSlug),
          notInArray(trickDefinitions.sourceId, normalized.map((trick) => trick.sourceId)),
        ))
    }
    await tx
      .update(trickCatalogStates)
      .set({ version: sql`${trickCatalogStates.version} + 1`, updatedAt: new Date() })
      .where(eq(trickCatalogStates.disciplineSlug, disciplineSlug))
  })
}

export async function ensureCurrentTrickCatalogSnapshot(
  tx: Tx,
  disciplineSlug: string,
): Promise<string> {
  await ensureCatalogState(tx, disciplineSlug)
  const tricks = await canonicalTricks(tx, disciplineSlug)
  if (tricks.length === 0) throw new Error("A catalog must contain at least one trick")
  const definition = definitionFor(disciplineSlug)
  const sourceSha256 = canonicalHash(disciplineSlug, tricks)
  const [existing] = await tx
    .select({ id: challengeCatalogs.id })
    .from(challengeCatalogs)
    .where(and(
      eq(challengeCatalogs.disciplineSlug, disciplineSlug),
      eq(challengeCatalogs.sourceSha256, sourceSha256),
    ))
  if (existing) return existing.id

  const levels: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const trick of tricks) levels[trick.level as 1 | 2 | 3 | 4 | 5] += 1
  const [catalog] = await tx
    .insert(challengeCatalogs)
    .values({
      disciplineSlug,
      challengeKey: definition.challengeKey,
      gameName: definition.gameName,
      eliminationWord: definition.eliminationWord,
      wordLength: definition.wordLength,
      sourcePath: "database",
      sourceSha256,
      trickCount: tricks.length,
      levelOneCount: levels[1],
      levelTwoCount: levels[2],
      levelThreeCount: levels[3],
      levelFourCount: levels[4],
      levelFiveCount: levels[5],
    })
    .returning({ id: challengeCatalogs.id })
  if (!catalog) throw new Error("Catalog could not be created")

  const insertedTricks = await tx
    .insert(challengeCatalogTricks)
    .values(tricks.map((trick) => ({
      catalogId: catalog.id,
      sourceId: trick.sourceId,
      name: trick.name,
      description: trick.description,
      level: trick.level,
      categories: [...trick.categories],
    })))
    .returning({ id: challengeCatalogTricks.id, sourceId: challengeCatalogTricks.sourceId })
  const bySourceId = new Map(tricks.map((trick) => [trick.sourceId, trick]))
  const compatibility = insertedTricks.flatMap((trick) =>
    (bySourceId.get(trick.sourceId)?.compatibleSpotTypes ?? []).map((spotTypeSlug) => ({
      trickId: trick.id,
      spotTypeSlug,
    })),
  )
  if (compatibility.length > 0) await tx.insert(challengeTrickSpotTypes).values(compatibility)
  return catalog.id
}
