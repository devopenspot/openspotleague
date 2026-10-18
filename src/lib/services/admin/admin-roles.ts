import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { adminAuditLog, authUsers, roles, userRoles } from "@/db/schema"
import { getDbClient, withDbRetry, withDbWrite } from "@/lib/db/client"
import { queueTagRevalidate } from "@/lib/cache/deferred"
import { AUTHZ_CACHE_LIFE } from "@/lib/cache/lifetimes"
import {
  AuthorizationError,
  ROLE_SLUGS,
  type RoleSlug,
} from "@/lib/services/profile/authorization"
import { InvalidReferenceError } from "@/lib/repositories/core/errors"
import { log } from "@/lib/utils/log"

export interface UserRoleAssignment {
  slug: RoleSlug
  name: string
  description: string
  grantedBy: string | null
  createdAt: string
}

export class LastAdministratorError extends Error {
  constructor() {
    super("The system must retain at least one administrator")
    this.name = "LastAdministratorError"
  }
}

function assertRoleSlugs(values: readonly string[]): readonly RoleSlug[] {
  const unique = Array.from(new Set(values))
  const invalid = unique.filter(
    (value): value is string => !ROLE_SLUGS.includes(value as RoleSlug),
  )
  if (invalid.length > 0) {
    throw new InvalidReferenceError(`Unknown role: ${invalid.join(", ")}`)
  }
  return unique as RoleSlug[]
}

function mapAssignments(
  rows: readonly {
    slug: string
    name: string
    description: string
    grantedBy: string | null
    createdAt: Date
  }[],
): UserRoleAssignment[] {
  return rows.map((row) => ({
    slug: row.slug as RoleSlug,
    name: row.name,
    description: row.description,
    grantedBy: row.grantedBy,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function listUserRoles(
  userId: string,
): Promise<readonly UserRoleAssignment[]> {
  const { db } = getDbClient()
  return withDbRetry(
    () =>
      db.transaction(async (tx) => {
        const [target] = await tx
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, userId))
          .limit(1)
        if (!target) throw new Error(`User not found: ${userId}`)
        return tx
          .select({
            slug: roles.slug,
            name: roles.name,
            description: roles.description,
            grantedBy: userRoles.grantedBy,
            createdAt: userRoles.createdAt,
          })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(eq(userRoles.userId, userId))
          .orderBy(roles.slug)
      }),
    "admin.roles.list",
  ).then(mapAssignments)
}

export async function replaceUserRoles(
  userId: string,
  requestedRoles: readonly string[],
  grantedBy: string,
): Promise<readonly UserRoleAssignment[]> {
  const roleSlugs = assertRoleSlugs(requestedRoles)
  const { db } = getDbClient()

  return withDbWrite(
    "admin.roles.replace",
    () =>
      db.transaction(async (tx) => {
        const [target] = await tx
          .select({ id: authUsers.id })
          .from(authUsers)
          .where(eq(authUsers.id, userId))
          .limit(1)
          .for("update")
        if (!target) throw new Error(`User not found: ${userId}`)

        const [adminRole] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.slug, "admin"))
          .limit(1)
          .for("update")
        if (!adminRole) throw new InvalidReferenceError("Admin role is unavailable")

        const [grantor] = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(
            and(
              eq(userRoles.userId, grantedBy),
              eq(userRoles.roleId, adminRole.id),
            ),
          )
          .limit(1)
        if (!grantor) throw new AuthorizationError("FORBIDDEN")

        const roleRows = await tx
          .select({ id: roles.id, slug: roles.slug })
          .from(roles)
          .where(inArray(roles.slug, roleSlugs))
        if (roleRows.length !== roleSlugs.length) {
          throw new InvalidReferenceError("One or more roles are unavailable")
        }

        const current = await tx
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(eq(userRoles.userId, userId))
          .for("update")

        // Scalability: avoid loading all administrator assignments. Lock only the
        // target's admin row + up to 2 admin rows to decide last-admin case.
        const [targetAdminRow] = await tx
          .select({ userId: userRoles.userId })
          .from(userRoles)
          .where(
            and(eq(userRoles.userId, userId), eq(userRoles.roleId, adminRole.id)),
          )
          .for("update")
          .limit(1)
        const targetIsAdministrator = Boolean(targetAdminRow)
        if (targetIsAdministrator && !roleSlugs.includes("admin")) {
          const adminRows = await tx
            .select({ userId: userRoles.userId })
            .from(userRoles)
            .where(eq(userRoles.roleId, adminRole.id))
            .for("update")
            .limit(2)
          if (adminRows.length <= 1) {
            throw new LastAdministratorError()
          }
        }
        const requestedIds = new Set(roleRows.map((row) => row.id))
        const removedIds = current
          .map((row) => row.roleId)
          .filter((roleId) => !requestedIds.has(roleId))
        if (removedIds.length > 0) {
          await tx
            .delete(userRoles)
            .where(
              and(
                eq(userRoles.userId, userId),
                inArray(userRoles.roleId, removedIds),
              ),
            )
        }

        const beforeSlugs = current
          .map((r) => roleRows.find((rr) => rr.id === r.roleId)?.slug ?? r.roleId)
          .sort()
        const currentIds = new Set(current.map((row) => row.roleId))
        const additions = roleRows
          .filter((row) => !currentIds.has(row.id))
          .map((row) => ({ userId, roleId: row.id, grantedBy }))
        if (additions.length > 0) {
          await tx.insert(userRoles).values(additions)
        }

        const afterRows = await tx
          .select({
            slug: roles.slug,
            name: roles.name,
            description: roles.description,
            grantedBy: userRoles.grantedBy,
            createdAt: userRoles.createdAt,
          })
          .from(userRoles)
          .innerJoin(roles, eq(roles.id, userRoles.roleId))
          .where(eq(userRoles.userId, userId))
          .orderBy(roles.slug)
        const afterSlugs = afterRows.map((r) => r.slug).sort()
        // Append-only audit (insert only, trigger prevents update/delete)
        await tx.insert(adminAuditLog).values({
          actorId: grantedBy,
          targetUserId: userId,
          action: "replace_roles",
          before: beforeSlugs,
          after: afterSlugs,
        })
        log.info("audit.admin.roles.replace", {
          actorId: grantedBy,
          targetUserId: userId,
          before: beforeSlugs,
          after: afterSlugs,
        })
        queueTagRevalidate(`authz:user:${userId}`, AUTHZ_CACHE_LIFE)

        return afterRows
      }),
  ).then(mapAssignments)
}
