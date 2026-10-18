// Deterministic application seed. Data scope is spots + admin only:
// events, challenge catalogs and user activity stay out of the seed
// (tables remain empty, feature code dormant) — see
// .agents/specs/spots-migration/spot-migration.spec.md.

import "./load-env"
import { sql } from "drizzle-orm"
import { closeDb, getDbClient } from "@/lib/db/client"
import { env } from "@/lib/config/env"
import { log } from "@/lib/utils/log"
import {
  permissions,
  profiles,
  rolePermissions,
  roles,
  userRoles,
} from "@/db/schema"
import { buildCountrySeed, type CountrySeed } from "./seed-data/countries"
import { REGION_SEED } from "./seed-data/regions"
import {
  EVENT_CATEGORY_SEED,
  SPORT_DISCIPLINE_SEED,
  SPOT_TYPE_SEED,
} from "./seed-data/taxonomy"
import { migrateSpots } from "./seed-data/spots-migration"

type Db = ReturnType<typeof getDbClient>["db"]

const PERMISSION_SEED = [
  { slug: "content.read", name: "Read content", description: "Read curated application content." },
  { slug: "content.write", name: "Write content", description: "Create and edit spots and events." },
  { slug: "media.manage", name: "Manage media", description: "Upload and manage spot and event media." },
  { slug: "taxonomy.use", name: "Use taxonomy", description: "Assign approved content taxonomy." },
  { slug: "roles.manage", name: "Manage roles", description: "Assign roles and permissions." },
  { slug: "users.manage", name: "Manage users", description: "Manage application user access." },
  { slug: "database.reset", name: "Reset database", description: "Run the non-production application reset." },
  { slug: "migrations.manage", name: "Manage migrations", description: "Apply the application baseline." },
  { slug: "operational.settings", name: "Manage operational settings", description: "Change sensitive operational settings." },
  { slug: "league.manage", name: "Manage league", description: "Manage league plans, payments and account grants." },
] as const

const ROLE_SEED = [
  { slug: "admin", name: "Admin", description: "Unrestricted application administration." },
  { slug: "curator", name: "Curator", description: "Curated content and media maintenance (legacy)." },
  { slug: "spot_curator", name: "Spot Curator", description: "Manage spots scoped by country." },
  { slug: "event_curator", name: "Event Curator", description: "Manage events scoped by country." },
  { slug: "trick_curator", name: "Trick Curator", description: "Manage tricks scoped by discipline." },
] as const

const ADMIN_PERMISSION_SLUGS = PERMISSION_SEED.map((permission) => permission.slug)
const CURATOR_PERMISSION_SLUGS = [
  "content.read",
  "content.write",
  "media.manage",
  "taxonomy.use",
] as const
const SPOT_CURATOR_PERMISSION_SLUGS = [
  "content.read",
  "content.write",
  "media.manage",
  "taxonomy.use",
] as const
const EVENT_CURATOR_PERMISSION_SLUGS = [
  "content.read",
  "content.write",
  "media.manage",
  "taxonomy.use",
] as const
const TRICK_CURATOR_PERMISSION_SLUGS = [
  "content.read",
  "taxonomy.use",
] as const

async function seedRegions(db: Db): Promise<void> {
  for (const region of REGION_SEED) {
    await db.execute(sql`
      insert into regions (slug, name, description, image_url, sort_order)
      values (${region.slug}, ${region.name}, ${region.desc}, ${region.image}, ${region.sortOrder})
      on conflict (slug) do update set
        name = excluded.name,
        description = excluded.description,
        image_url = excluded.image_url,
        sort_order = excluded.sort_order,
        updated_at = now()
    `)
  }
  log.info("seed.regions.done", { count: REGION_SEED.length })
}

async function seedCountries(db: Db): Promise<void> {
  const countries: readonly CountrySeed[] = buildCountrySeed()
  const regionRows = await db.execute<{ id: string; name: string }>(sql`
    select id, name from regions
  `)
  const regionIdByName = new Map(regionRows.map((row) => [row.name, row.id]))
  let count = 0
  for (const country of countries) {
    const regionId = regionIdByName.get(country.region)
    if (!regionId) throw new Error(`Missing region for country ${country.name}`)
    await db.execute(sql`
      insert into countries (iso2, name, iso3, region_id)
      values (${country.iso2}, ${country.name}, ${country.iso3 || null}, ${regionId})
      on conflict (iso2) do update set
        name = excluded.name,
        iso3 = excluded.iso3,
        region_id = excluded.region_id,
        updated_at = now()
    `)
    count += 1
  }
  log.info("seed.countries.done", { count })
}

async function seedDimensions(db: Db): Promise<void> {
  for (const entry of SPOT_TYPE_SEED) {
    await db.execute(sql`
      insert into spot_types (slug, name, sort_order)
      values (${entry.slug}, ${entry.name}, ${entry.sortOrder})
      on conflict (slug) do nothing
    `)
  }
  for (const entry of SPORT_DISCIPLINE_SEED) {
    await db.execute(sql`
      insert into sport_disciplines (slug, name, sort_order)
      values (${entry.slug}, ${entry.name}, ${entry.sortOrder})
      on conflict (slug) do nothing
    `)
  }
  for (const entry of EVENT_CATEGORY_SEED) {
    await db.execute(sql`
      insert into event_categories (slug, name, sort_order)
      values (${entry.slug}, ${entry.name}, ${entry.sortOrder})
      on conflict (slug) do nothing
    `)
  }
  log.info("seed.dimensions.done", {
    spotTypes: SPOT_TYPE_SEED.length,
    disciplines: SPORT_DISCIPLINE_SEED.length,
    eventCategories: EVENT_CATEGORY_SEED.length,
  })
}

async function seedRoles(db: Db): Promise<void> {
  await db
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
  await db
    .insert(roles)
    .values(ROLE_SEED.map((role) => ({ ...role })))
    .onConflictDoUpdate({
      target: roles.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        updatedAt: new Date(),
      },
    })

  const roleRows = await db.select({ id: roles.id, slug: roles.slug }).from(roles)
  const permissionRows = await db.select({ id: permissions.id, slug: permissions.slug }).from(permissions)
  const roleIdBySlug = new Map(roleRows.map((row) => [row.slug, row.id]))
  const permissionIdBySlug = new Map(permissionRows.map((row) => [row.slug, row.id]))
  const assignments = [
    ...ADMIN_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "admin", permissionSlug: slug })),
    ...CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "curator", permissionSlug: slug })),
    ...SPOT_CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "spot_curator", permissionSlug: slug })),
    ...EVENT_CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "event_curator", permissionSlug: slug })),
    ...TRICK_CURATOR_PERMISSION_SLUGS.map((slug) => ({ roleSlug: "trick_curator", permissionSlug: slug })),
  ]
  await db
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

async function bootstrapAdminUsers(db: Db): Promise<void> {
  const emails = [...new Set(
    env.ADMIN_EMAILS
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )]
  if (emails.length === 0) return

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
    const user = users[0]
    if (!user) {
      log.warn("seed.roles.bootstrap_user_missing", { email })
      continue
    }
    // Mirror the app's profile provisioning (userFromClaims in
    // src/lib/auth/auth.ts) so the admin user exists deterministically
    // after a from-scratch reset.
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

async function main() {
  const { db } = getDbClient()
  try {
    await seedRegions(db)
    await seedCountries(db)
    await seedDimensions(db)
    await seedRoles(db)
    await seedContent(db)
    await bootstrapAdminUsers(db)
    log.info("seed.complete")
  } finally {
    await closeDb()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
