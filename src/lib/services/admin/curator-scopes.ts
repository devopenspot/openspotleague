import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { adminAuditLog, authUsers, curatorCountryScopes, curatorDisciplineScopes, countries, roles, sportDisciplines, userRoles } from "@/db/schema"
import { getDbClient, withDbRetry, withDbWrite } from "@/lib/db/client"
import { queueTagRevalidate } from "@/lib/cache/deferred"
import { AUTHZ_CACHE_LIFE } from "@/lib/cache/lifetimes"
import { AuthorizationError } from "@/lib/services/profile/authorization"
import { InvalidReferenceError } from "@/lib/repositories/core/errors"
import { log } from "@/lib/utils/log"

export interface CuratorScopes {
  countryCodes: readonly string[]
  disciplineSlugs: readonly string[]
}

export async function listCuratorScopes(userId: string): Promise<CuratorScopes> {
  const { db } = getDbClient()
  return withDbRetry(
    () =>
      db.transaction(async (tx) => {
        const [target] = await tx.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, userId)).limit(1)
        if (!target) throw new Error(`User not found: ${userId}`)
        const countries = await tx.select({ code: curatorCountryScopes.countryCode }).from(curatorCountryScopes).where(eq(curatorCountryScopes.userId, userId)).orderBy(curatorCountryScopes.countryCode)
        const disciplines = await tx.select({ slug: curatorDisciplineScopes.disciplineSlug }).from(curatorDisciplineScopes).where(eq(curatorDisciplineScopes.userId, userId)).orderBy(curatorDisciplineScopes.disciplineSlug)
        return { countryCodes: countries.map((r) => r.code), disciplineSlugs: disciplines.map((r) => r.slug) }
      }),
    "curator.scopes.list",
  )
}

export async function replaceCuratorScopes(
  userId: string,
  input: { countryCodes: readonly string[]; disciplineSlugs: readonly string[] },
  grantedBy: string,
): Promise<CuratorScopes> {
  const countryCodes = Array.from(new Set(input.countryCodes.map((c) => c.trim().toUpperCase()).filter(Boolean)))
  const disciplineSlugs = Array.from(new Set(input.disciplineSlugs.map((d) => d.trim().toLowerCase()).filter(Boolean)))
  const { db } = getDbClient()
  return withDbWrite(
    "curator.scopes.replace",
    () =>
      db.transaction(async (tx) => {
        const [target] = await tx.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, userId)).for("update").limit(1)
        if (!target) throw new Error(`User not found: ${userId}`)

        // Validate existence
        if (countryCodes.length > 0) {
          const rows = await tx.select({ iso2: countries.iso2 }).from(countries).where(inArray(countries.iso2, countryCodes))
          const found = new Set(rows.map((r) => r.iso2))
          const missing = countryCodes.filter((c) => !found.has(c))
          if (missing.length > 0) throw new InvalidReferenceError(`Country not found: ${missing.join(", ")}`)
        }
        if (disciplineSlugs.length > 0) {
          const rows = await tx.select({ slug: sportDisciplines.slug }).from(sportDisciplines).where(inArray(sportDisciplines.slug, disciplineSlugs))
          const found = new Set(rows.map((r) => r.slug))
          const missing = disciplineSlugs.filter((s) => !found.has(s))
          if (missing.length > 0) throw new InvalidReferenceError(`Discipline not found: ${missing.join(", ")}`)
        }

        // Ensure grantor is admin
        const [adminRoleRow] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.slug, "admin")).limit(1)
        if (!adminRoleRow) throw new InvalidReferenceError("Admin role is unavailable")
        const grantorRows = await tx.select({ userId: userRoles.userId }).from(userRoles).where(and(eq(userRoles.userId, grantedBy), eq(userRoles.roleId, adminRoleRow.id))).limit(1)
        if (grantorRows.length === 0) throw new AuthorizationError("FORBIDDEN")

        // Countries sync
        const currentCountries = await tx.select({ code: curatorCountryScopes.countryCode }).from(curatorCountryScopes).where(eq(curatorCountryScopes.userId, userId))
        const currentCountrySet = new Set(currentCountries.map((r) => r.code))
        const desiredCountrySet = new Set(countryCodes)
        const toRemoveCountries = [...currentCountrySet].filter((c) => !desiredCountrySet.has(c))
        const toAddCountries = [...desiredCountrySet].filter((c) => !currentCountrySet.has(c))
        if (toRemoveCountries.length > 0) {
          await tx.delete(curatorCountryScopes).where(and(eq(curatorCountryScopes.userId, userId), inArray(curatorCountryScopes.countryCode, toRemoveCountries)))
        }
        if (toAddCountries.length > 0) {
          await tx.insert(curatorCountryScopes).values(toAddCountries.map((code) => ({ userId, countryCode: code, grantedBy })))
        }

        // Disciplines sync
        const currentDisc = await tx.select({ slug: curatorDisciplineScopes.disciplineSlug }).from(curatorDisciplineScopes).where(eq(curatorDisciplineScopes.userId, userId))
        const currentDiscSet = new Set(currentDisc.map((r) => r.slug))
        const desiredDiscSet = new Set(disciplineSlugs)
        const toRemoveDisc = [...currentDiscSet].filter((s) => !desiredDiscSet.has(s))
        const toAddDisc = [...desiredDiscSet].filter((s) => !currentDiscSet.has(s))
        if (toRemoveDisc.length > 0) {
          await tx.delete(curatorDisciplineScopes).where(and(eq(curatorDisciplineScopes.userId, userId), inArray(curatorDisciplineScopes.disciplineSlug, toRemoveDisc)))
        }
        if (toAddDisc.length > 0) {
          await tx.insert(curatorDisciplineScopes).values(toAddDisc.map((slug) => ({ userId, disciplineSlug: slug, grantedBy })))
        }

        const finalCountries = await tx.select({ code: curatorCountryScopes.countryCode }).from(curatorCountryScopes).where(eq(curatorCountryScopes.userId, userId)).orderBy(curatorCountryScopes.countryCode)
        const finalDisc = await tx.select({ slug: curatorDisciplineScopes.disciplineSlug }).from(curatorDisciplineScopes).where(eq(curatorDisciplineScopes.userId, userId)).orderBy(curatorDisciplineScopes.disciplineSlug)
        const after = { countryCodes: finalCountries.map((r) => r.code), disciplineSlugs: finalDisc.map((r) => r.slug) }
        const before = {
          countryCodes: currentCountries.map((r) => r.code).sort(),
          disciplineSlugs: currentDisc.map((r) => r.slug).sort(),
        }
        // Two audit rows if both scopes changed, else one; keep separate actions
        if (JSON.stringify(before.countryCodes) !== JSON.stringify(after.countryCodes)) {
          await tx.insert(adminAuditLog).values({
            actorId: grantedBy,
            targetUserId: userId,
            action: "replace_country_scopes",
            before: before.countryCodes,
            after: after.countryCodes,
          })
        }
        if (JSON.stringify(before.disciplineSlugs) !== JSON.stringify(after.disciplineSlugs)) {
          await tx.insert(adminAuditLog).values({
            actorId: grantedBy,
            targetUserId: userId,
            action: "replace_discipline_scopes",
            before: before.disciplineSlugs,
            after: after.disciplineSlugs,
          })
        }
        log.info("audit.admin.scopes.replace", {
          actorId: grantedBy,
          targetUserId: userId,
          before,
          after,
        })
        queueTagRevalidate(`authz:user:${userId}`, AUTHZ_CACHE_LIFE)
        return after
      }),
  )
}
