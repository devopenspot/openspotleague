// Deterministic application seed. Seeds foundation (regions, countries,
// cities, spot types, disciplines, event categories, event plans, RBAC),
// content (spots, images, assignments), TV videos, and challenge trick catalogs.

import "./load-env"
import { sql } from "drizzle-orm"
import { closeDb, getDbClient } from "@/lib/db/client"
import { env } from "@/lib/config/env"
import { log } from "@/lib/utils/log"
import {
  cities,
  countries,
  eventCategories,
  eventPlans,
  permissions,
  profiles,
  regions,
  rolePermissions,
  roles,
  sportDisciplines,
  spotTypes,
  userRoles,
} from "@/db/schema"
import { buildCountrySeed, type CountrySeed } from "./seed-data/countries"
import { REGION_SEED, CITY_SEED } from "./seed-data/regions"
import {
  EVENT_CATEGORY_SEED,
  EVENT_PLAN_SEED,
  SPORT_DISCIPLINE_SEED,
  SPOT_TYPE_SEED,
} from "./seed-data/taxonomy"
import {
  ADMIN_PERMISSION_SLUGS,
  CURATOR_PERMISSION_SLUGS,
  EVENT_CURATOR_PERMISSION_SLUGS,
  PERMISSION_SEED,
  ROLE_SEED,
  SPOT_CURATOR_PERMISSION_SLUGS,
  TRICK_CURATOR_PERMISSION_SLUGS,
} from "./seed-data/rbac"
import { migrateSpots } from "./seed-data/spots-migration"
import { seedTvVideos } from "./seed-tv"
import { seedChallengeCatalogs } from "./seed-data/challenge-catalogs"

type Db = ReturnType<typeof getDbClient>["db"]
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0]

async function seedRegions(tx: Tx): Promise<void> {
  const values = REGION_SEED.map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.desc,
    imageUrl: r.image,
    sortOrder: r.sortOrder,
  }))
  await tx
    .insert(regions)
    .values(values)
    .onConflictDoUpdate({
      target: regions.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        imageUrl: sql`excluded.image_url`,
        sortOrder: sql`excluded.sort_order`,
        updatedAt: new Date(),
      },
    })
  log.info("seed.regions.done", { count: values.length })
}

async function seedCountries(tx: Tx): Promise<void> {
  const countryList: readonly CountrySeed[] = buildCountrySeed()
  const regionRows = await tx.select({ id: regions.id, slug: regions.slug }).from(regions)
  const regionIdBySlug = new Map(regionRows.map((row) => [row.slug, row.id]))

  // Resolve regionId from region name by matching slug
  const regionSlugByName = new Map<string, string>()
  for (const r of REGION_SEED) {
    regionSlugByName.set(r.name, r.slug)
  }

  const values = countryList.map((country) => {
    const slug = regionSlugByName.get(country.region) ?? country.region.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    const regionId = regionIdBySlug.get(slug)
    if (!regionId) throw new Error(`Missing region ID for ${country.name} (${country.region})`)
    return {
      iso2: country.iso2,
      name: country.name,
      iso3: country.iso3 || null,
      regionId,
    }
  })

  await tx
    .insert(countries)
    .values(values)
    .onConflictDoUpdate({
      target: countries.iso2,
      set: {
        name: sql`excluded.name`,
        iso3: sql`excluded.iso3`,
        regionId: sql`excluded.region_id`,
        updatedAt: new Date(),
      },
    })
  log.info("seed.countries.done", { count: values.length })
}

async function seedCities(tx: Tx): Promise<void> {
  const CHUNK_SIZE = 500
  for (let i = 0; i < CITY_SEED.length; i += CHUNK_SIZE) {
    const chunk = CITY_SEED.slice(i, i + CHUNK_SIZE).map((c) => ({
      countryCode: c.countryCode,
      slug: c.slug,
      name: c.name,
      sortOrder: c.sortOrder,
    }))
    await tx
      .insert(cities)
      .values(chunk)
      .onConflictDoUpdate({
        target: [cities.countryCode, cities.slug],
        set: {
          name: sql`excluded.name`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: new Date(),
        },
      })
  }
  log.info("seed.cities.done", { count: CITY_SEED.length })
}

async function seedDimensions(tx: Tx): Promise<void> {
  if (SPOT_TYPE_SEED.length > 0) {
    await tx
      .insert(spotTypes)
      .values(SPOT_TYPE_SEED.map((entry) => ({ slug: entry.slug, name: entry.name, sortOrder: entry.sortOrder })))
      .onConflictDoUpdate({
        target: spotTypes.slug,
        set: { name: sql`excluded.name`, sortOrder: sql`excluded.sort_order` },
      })
  }

  if (SPORT_DISCIPLINE_SEED.length > 0) {
    await tx
      .insert(sportDisciplines)
      .values(SPORT_DISCIPLINE_SEED.map((entry) => ({ slug: entry.slug, name: entry.name, sortOrder: entry.sortOrder })))
      .onConflictDoUpdate({
        target: sportDisciplines.slug,
        set: { name: sql`excluded.name`, sortOrder: sql`excluded.sort_order` },
      })
  }

  if (EVENT_CATEGORY_SEED.length > 0) {
    await tx
      .insert(eventCategories)
      .values(EVENT_CATEGORY_SEED.map((entry) => ({ slug: entry.slug, name: entry.name, sortOrder: entry.sortOrder })))
      .onConflictDoUpdate({
        target: eventCategories.slug,
        set: { name: sql`excluded.name`, sortOrder: sql`excluded.sort_order` },
      })
  }

  if (EVENT_PLAN_SEED.length > 0) {
    await tx
      .insert(eventPlans)
      .values(EVENT_PLAN_SEED.map((p) => ({
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        currency: p.currency,
        maxRiders: p.maxRiders,
        maxJudges: p.maxJudges,
        maxOrganizers: p.maxOrganizers,
        monthlyEventLimit: p.monthlyEventLimit,
        isDefault: p.isDefault,
        active: p.active,
        sortOrder: p.sortOrder,
      })))
      .onConflictDoUpdate({
        target: eventPlans.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          priceCents: sql`excluded.price_cents`,
          currency: sql`excluded.currency`,
          maxRiders: sql`excluded.max_riders`,
          maxJudges: sql`excluded.max_judges`,
          maxOrganizers: sql`excluded.max_organizers`,
          monthlyEventLimit: sql`excluded.monthly_event_limit`,
          isDefault: sql`excluded.is_default`,
          active: sql`excluded.active`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: new Date(),
        },
      })
  }

  log.info("seed.dimensions.done", {
    spotTypes: SPOT_TYPE_SEED.length,
    disciplines: SPORT_DISCIPLINE_SEED.length,
    eventCategories: EVENT_CATEGORY_SEED.length,
    eventPlans: EVENT_PLAN_SEED.length,
  })
}

async function seedRoles(tx: Tx): Promise<void> {
  await tx
    .insert(permissions)
    .values(PERMISSION_SEED.map((permission) => ({ ...permission })))
    .onConflictDoUpdate({
      target: permissions.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        updatedAt: new Date(),
      },
    })

  await tx
    .insert(roles)
    .values(ROLE_SEED.map((role) => ({ slug: role.slug, name: role.name, description: role.description })))
    .onConflictDoUpdate({
      target: roles.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        updatedAt: new Date(),
      },
    })

  const roleRows = await tx.select({ id: roles.id, slug: roles.slug }).from(roles)
  const permissionRows = await tx.select({ id: permissions.id, slug: permissions.slug }).from(permissions)
  const roleIdBySlug = new Map(roleRows.map((row) => [row.slug, row.id]))
  const permissionIdBySlug = new Map(permissionRows.map((row) => [row.slug, row.id]))

  const assignments = [
    ...ADMIN_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "admin", permissionSlug: slug })),
    ...CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "curator", permissionSlug: slug })),
    ...SPOT_CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "spot_curator", permissionSlug: slug })),
    ...EVENT_CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "event_curator", permissionSlug: slug })),
    ...TRICK_CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "trick_curator", permissionSlug: slug })),
  ]

  await tx
    .insert(rolePermissions)
    .values(
      assignments.map(({ roleSlug, permissionSlug }) => {
        const roleId = roleIdBySlug.get(roleSlug)
        const permissionId = permissionIdBySlug.get(permissionSlug)
        if (!roleId || !permissionId) throw new Error(`Missing RBAC seed row for ${roleSlug}/${permissionSlug}`)
        return { roleId, permissionId }
      }),
    )
    .onConflictDoNothing()

  log.info("seed.roles.done", { roles: ROLE_SEED.length, permissions: PERMISSION_SEED.length })
}

async function seedCoreFoundation(db: Db): Promise<void> {
  log.info("seed.foundation.start")
  await db.transaction(async (tx) => {
    await tx.execute(sql`set local statement_timeout = '120s'`)
    await seedRegions(tx)
    await seedCountries(tx)
    await seedCities(tx)
    await seedDimensions(tx)
    await seedRoles(tx)
  })
  log.info("seed.foundation.done")
}

async function seedContent(db: Db): Promise<void> {
  const result = await migrateSpots(db)
  log.info("seed.content.done", {
    spots: result.spots,
    images: result.images,
    disciplines: result.disciplines,
    typeAssignments: result.typeAssignments,
    durationMs: result.durationMs,
  })
}

async function bootstrapAdminUsers(db: Db): Promise<void> {
  const rawList = env.ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
  if (!rawList.includes("devopenspot@gmail.com")) {
    rawList.push("devopenspot@gmail.com")
  }
  const emails = [...new Set(rawList)]

  const adminRole = await db
    .select({ id: roles.id })
    .from(roles)
    .where(sql`${roles.slug} = 'admin'`)
    .limit(1)
  const roleId = adminRole[0]?.id
  if (!roleId) throw new Error("Admin role was not seeded")

  for (const email of emails) {
    const users = await db.execute<{
      id: string
      email: string | null
      meta: Record<string, unknown> | null
    }>(sql`
      select id, email, raw_user_meta_data as meta
      from auth.users
      where lower(email) = ${email}
      limit 1
    `)
    let user = users[0]
    if (!user) {
      try {
        const { getSupabaseAdminClient } = await import("@/lib/supabase/admin")
        const adminClient = getSupabaseAdminClient()
        const { data: created, error } = await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name: "OpenSpot Admin" },
        })
        if (!error && created?.user) {
          user = {
            id: created.user.id,
            email: created.user.email ?? email,
            meta: (created.user.user_metadata as Record<string, unknown>) ?? null,
          }
          log.info("seed.roles.bootstrap_user_created", { email, id: user.id })
        }
      } catch {
        // Supabase service key may be offline or unconfigured in isolated environments
      }
    }

    if (!user) {
      log.warn("seed.roles.bootstrap_user_missing", { email })
      continue
    }

    const meta = user.meta ?? {}
    const displayName =
      (typeof meta["name"] === "string" && meta["name"]) ||
      (user.email ?? email).split("@")[0] ||
      "Admin"
    const initials =
      (typeof meta["initials"] === "string" && meta["initials"]) ||
      displayName
        .split(/\s+/)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("") ||
      "OS"

    await db
      .insert(profiles)
      .values({
        id: user.id,
        displayName,
        email: user.email ?? email,
        initials,
      })
      .onConflictDoNothing({ target: profiles.id })

    await db
      .insert(userRoles)
      .values({ userId: user.id, roleId, grantedBy: null })
      .onConflictDoNothing()
    log.info("seed.roles.bootstrap_admin", { userId: user.id })
  }
}

async function main() {
  const { db } = getDbClient()
  try {
    await seedCoreFoundation(db)
    await seedContent(db)
    await seedTvVideos(db)
    await seedChallengeCatalogs(db)
    await bootstrapAdminUsers(db)

    // Refresh query planner stats across all seeded tables
    await db.execute(
      sql`analyze regions, countries, cities, spot_types, sport_disciplines, event_categories, event_plans, spots, spot_images, spot_type_assignments, tv_videos, trick_definitions, challenge_catalogs`,
    ).catch(() => undefined)

    log.info("seed.complete")
  } finally {
    await closeDb()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
