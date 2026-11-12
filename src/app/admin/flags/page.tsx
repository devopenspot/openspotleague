import { connection } from "next/server"
import { requireAdministratorOrRedirect } from "@/lib/auth/server"
import { env } from "@/lib/config/env"
import { listFlagStates } from "@/lib/services/flags/feature-flags"
import { FlagManager } from "@/components/admin/flags/FlagManager"

export const metadata = {
  title: "Admin · Feature flags",
}

export default async function AdminFlagsPage() {
  await connection()
  await requireAdministratorOrRedirect("/admin/flags")
  const flags = await listFlagStates()

  return (
    <section id="admin-flags" aria-labelledby="admin-flags-heading" className="space-y-6 animate-fade-in">
      <header className="border-b border-outline-variant pb-6">
        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Environment: {env.APP_ENV}
        </span>
        <h1
          id="admin-flags-heading"
          className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl"
        >
          Feature flags
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
          Turn big features on for admins, a share of users, or everyone, in this environment only. Changes
          apply within a minute without a deploy. Flags are declared in code; see docs/feature-flags.md.
        </p>
      </header>

      <FlagManager initialFlags={flags} />
    </section>
  )
}
