import "../src/db/load-env"
import { eq, sql } from "drizzle-orm"
import { closeDb, getDbClient } from "@/lib/db/client"
import { profiles, roles, userRoles } from "@/db/schema"
import { getSupabaseAdminClient } from "@/lib/supabase/admin"

async function main() {
  const targetEmail = (process.argv[2] || "devopenspot@gmail.com").trim().toLowerCase()
  console.log(`\n========================================`)
  console.log(`OpenSpot Admin Bootstrap: ${targetEmail}`)
  console.log(`========================================\n`)

  const { db } = getDbClient()
  try {
    // 1. Check if admin role exists in public.roles
    const [adminRole] = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.slug, "admin"))
      .limit(1)

    if (!adminRole) {
      console.error(`✗ Error: 'admin' role not found in database. Run 'pnpm db:seed' first.`)
      process.exitCode = 1
      return
    }
    console.log(`✓ Admin role found (id: ${adminRole.id})`)

    // 2. Look up user in auth.users
    let userRows = await db.execute<{
      id: string
      email: string | null
      meta: Record<string, unknown> | null
    }>(sql`
      select id, email, raw_user_meta_data as meta
      from auth.users
      where lower(email) = ${targetEmail}
      limit 1
    `)

    let user = userRows[0]

    // 3. If missing from auth.users, attempt creation via Supabase Admin API
    if (!user) {
      console.log(`- User '${targetEmail}' not found in auth.users. Attempting auto-creation...`)
      try {
        const supabase = getSupabaseAdminClient()
        const { data: created, error } = await supabase.auth.admin.createUser({
          email: targetEmail,
          email_confirm: true,
          user_metadata: { name: "OpenSpot Admin" },
        })

        if (error) {
          console.warn(`! Supabase auth creation failed: ${error.message}`)
        } else if (created?.user) {
          console.log(`✓ Created user in Supabase Auth (id: ${created.user.id})`)
          user = {
            id: created.user.id,
            email: created.user.email ?? targetEmail,
            meta: (created.user.user_metadata as Record<string, unknown>) ?? null,
          }
        }
      } catch (err) {
        console.warn(`! Could not call Supabase Admin API: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (!user) {
      console.error(`\n✗ User '${targetEmail}' does not exist in auth.users.`)
      console.log(`  Please sign up at the application first with '${targetEmail}', then re-run this command:`)
      console.log(`  pnpm db:bootstrap-admin ${targetEmail}\n`)
      process.exitCode = 1
      return
    }

    console.log(`✓ User located in auth.users (id: ${user.id})`)

    // 4. Ensure profile exists
    const meta = user.meta ?? {}
    const displayName =
      (typeof meta["name"] === "string" && meta["name"]) ||
      (user.email ?? targetEmail).split("@")[0] ||
      "Admin"
    const initials =
      (typeof meta["initials"] === "string" && meta["initials"]) ||
      displayName
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("") ||
      "OS"

    await db
      .insert(profiles)
      .values({
        id: user.id,
        displayName,
        email: user.email ?? targetEmail,
        initials,
      })
      .onConflictDoNothing({ target: profiles.id })

    console.log(`✓ Profile verified for user '${displayName}'`)

    // 5. Grant admin role in user_roles
    await db
      .insert(userRoles)
      .values({
        userId: user.id,
        roleId: adminRole.id,
        grantedBy: null,
      })
      .onConflictDoNothing()

    // 6. Verify assignment
    const verification = await db.execute<{ role_slug: string }>(sql`
      select r.slug as role_slug
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.user_id = ${user.id} and r.slug = 'admin'
      limit 1
    `)

    if (verification.length > 0) {
      console.log(`\n🎉 Success! User '${targetEmail}' (id: ${user.id}) has been granted the 'admin' role.\n`)
    } else {
      console.error(`\n✗ Verification failed: role assignment could not be confirmed.\n`)
      process.exitCode = 1
    }
  } finally {
    await closeDb()
  }
}

main().catch((err) => {
  console.error("bootstrap-admin error:", err)
  process.exit(1)
})
