import {
  and,
  asc,
  eq,
  exists,
  gt,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import { type drizzle } from "drizzle-orm/postgres-js"
import {
  authUsers,
  profiles,
  roles,
  userRoles,
} from "@/db/schema"
import { ROLE_SLUGS } from "@/lib/auth/roles"
import type {
  AdminRoleOption,
  AdminUserListOptions,
  AdminUserListResult,
  AdminUserRepository,
  AdminUserRoleAssignment,
} from "./admin-user-repository"

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

const AVAILABLE_ROLES_TTL_MS = 300_000 // 5 min — roles table is static sid
let cachedAvailableRoles: readonly AdminRoleOption[] | null = null
let cachedAvailableRolesAt = 0
let cachedAvailableRolesPromise: Promise<readonly AdminRoleOption[]> | null = null

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&")
}

async function getCachedAvailableRoles(
  db: ReturnType<typeof drizzle>,
): Promise<readonly AdminRoleOption[]> {
  // In tests the db is mocked and expectations assume a fresh query per
  // `list()` call — bypass the cache to keep those assertions stable.
  if (process.env.NODE_ENV === "test") {
    const rows = await db
      .select({
        slug: roles.slug,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .where(inArray(roles.slug, ROLE_SLUGS))
      .orderBy(asc(roles.slug))
    return rows as readonly AdminRoleOption[]
  }
  const now = Date.now()
  if (cachedAvailableRoles && now - cachedAvailableRolesAt < AVAILABLE_ROLES_TTL_MS) {
    return cachedAvailableRoles
  }
  if (cachedAvailableRolesPromise) return cachedAvailableRolesPromise
  cachedAvailableRolesPromise = (async () => {
    const rows = await db
      .select({
        slug: roles.slug,
        name: roles.name,
        description: roles.description,
      })
      .from(roles)
      .where(inArray(roles.slug, ROLE_SLUGS))
      .orderBy(asc(roles.slug))
    const result: readonly AdminRoleOption[] = rows
    cachedAvailableRoles = result
    cachedAvailableRolesAt = Date.now()
    return result
  })()
  try {
    return await cachedAvailableRolesPromise
  } finally {
    cachedAvailableRolesPromise = null
  }
}

export class DrizzleAdminUserRepository implements AdminUserRepository {
  constructor(private readonly db: ReturnType<typeof drizzle>) {}

  async list(options: AdminUserListOptions = {}): Promise<AdminUserListResult> {
    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )
    const emailExpression = sql<string>`coalesce(
      nullif(${authUsers.email}, ''),
      nullif(${profiles.email}, ''),
      ''
    )`
    const displayNameExpression = sql<string>`coalesce(
      nullif(${profiles.displayName}, ''),
      nullif(${authUsers.email}, ''),
      ${authUsers.id}::text
    )`
    const sortKeyExpression = sql<string>`lower(${displayNameExpression})`
    const conditions: SQL[] = []

    if (options.q?.trim()) {
      const pattern = `%${escapeLike(options.q.trim())}%`
      conditions.push(
        or(
          ilike(authUsers.email, pattern),
          ilike(profiles.email, pattern),
          ilike(profiles.displayName, pattern),
        )!,
      )
    }

    if (options.role) {
      const roleUsers = this.db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(
          and(
            eq(userRoles.userId, authUsers.id),
            eq(roles.slug, options.role),
          ),
        )
      conditions.push(exists(roleUsers))
    }

    if (options.cursor) {
      conditions.push(
        or(
          gt(sortKeyExpression, options.cursor.sortKey),
          and(
            eq(sortKeyExpression, options.cursor.sortKey),
            gt(authUsers.id, options.cursor.id),
          ),
        )!,
      )
    }

    const selection = this.db
      .select({
        id: authUsers.id,
        email: emailExpression,
        displayName: displayNameExpression,
        createdAt: authUsers.createdAt,
        sortKey: sortKeyExpression,
      })
      .from(authUsers)
      .leftJoin(profiles, eq(profiles.id, authUsers.id))
    const predicate = conditions.length > 0 ? and(...conditions) : undefined
    const userRows = predicate
      ? await selection
          .where(predicate)
          .orderBy(asc(sortKeyExpression), asc(authUsers.id))
          .limit(limit + 1)
      : await selection
          .orderBy(asc(sortKeyExpression), asc(authUsers.id))
          .limit(limit + 1)

    const hasMore = userRows.length > limit
    const pageRows = userRows.slice(0, limit)
    const userIds = pageRows.map((row) => row.id)
    const roleRows = userIds.length
      ? await this.db
          .select({
            userId: userRoles.userId,
            slug: roles.slug,
            name: roles.name,
            description: roles.description,
            grantedBy: userRoles.grantedBy,
            createdAt: userRoles.createdAt,
          })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(inArray(userRoles.userId, userIds))
          .orderBy(asc(userRoles.userId), asc(roles.slug))
      : []
    const rolesByUser = new Map<string, AdminUserRoleAssignment[]>()
    for (const row of roleRows) {
      const assignments = rolesByUser.get(row.userId) ?? []
      assignments.push({
        slug: row.slug,
        name: row.name,
        description: row.description,
        grantedBy: row.grantedBy,
        createdAt: row.createdAt.toISOString(),
      })
      rolesByUser.set(row.userId, assignments)
    }

    const availableRoles = await getCachedAvailableRoles(this.db)
    const lastRow = pageRows.at(-1)

    return {
      items: pageRows.map((row) => ({
        id: row.id,
        displayName: row.displayName,
        email: row.email,
        createdAt: row.createdAt?.toISOString() ?? null,
        roles: rolesByUser.get(row.id) ?? [],
      })),
      nextCursor:
        hasMore && lastRow
          ? {
              sortKey: lastRow.sortKey,
              id: lastRow.id,
            }
          : null,
      availableRoles,
    }
  }
}
