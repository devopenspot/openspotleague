import { connection } from "next/server"
import { requireAdministratorOrRedirect } from "@/lib/auth/server"
import { ROLE_SLUGS, type RoleSlug } from "@/lib/services/profile/authorization"
import { runListAdminUsers } from "@/lib/services/admin/admin-users"
import {
  decodeAdminUserCursor,
  encodeAdminUserCursor,
} from "@/lib/repositories/admin/admin-user-pagination"
import { AdminUserManager } from "@/components/admin/users/AdminUserManager"

interface AdminUsersPageProps {
  searchParams: Promise<{
    q?: string
    role?: string
    cursor?: string
  }>
}

export const metadata = {
  title: "Admin · Users & roles",
}

function parseRole(value: string | undefined): RoleSlug | undefined {
  return ROLE_SLUGS.includes(value as RoleSlug)
    ? (value as RoleSlug)
    : undefined
}

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  await connection()
  await requireAdministratorOrRedirect("/admin/users")

  const params = await searchParams
  const q = firstParam(params.q).trim().slice(0, 100)
  const role = parseRole(firstParam(params.role))
  const cursorParam = firstParam(params.cursor)
  const cursor = cursorParam
    ? decodeAdminUserCursor(cursorParam)
    : null
  const result = await runListAdminUsers({
    q: q || undefined,
    role,
    cursor,
  })

  return (
    <section
      id="admin-users"
      aria-labelledby="admin-users-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="border-b border-outline-variant pb-6">
        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Access control
        </span>
        <h1
          id="admin-users-heading"
          className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl"
        >
          Users &amp; roles
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
          Assign curation access to existing Open Spot accounts. Authentication
          and account lifecycle remain managed by Supabase Auth.
        </p>
      </header>

      <AdminUserManager
        key={`${q}|${role ?? ""}|${cursorParam}`}
        initialUsers={result.items}
        availableRoles={result.availableRoles}
        initialNextCursor={
          result.nextCursor ? encodeAdminUserCursor(result.nextCursor) : null
        }
        initialQuery={q}
        initialRole={role ?? ""}
      />
    </section>
  )
}
