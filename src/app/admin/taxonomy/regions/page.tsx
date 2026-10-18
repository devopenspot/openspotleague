import { RegionManager } from "@/components/admin/regions/RegionManager"
import { connection } from "next/server"
import { runListAdminRegions, runListAdminCountries } from "@/lib/services/admin/admin-regions"
import { requireAdministratorOrRedirect } from "@/lib/auth/server"

export const metadata = { title: "Admin · Regions & Countries" }

export default async function AdminRegionsPage() {
  await connection()
  await requireAdministratorOrRedirect("/admin/taxonomy/regions")
  const [regions, countries] = await Promise.all([runListAdminRegions(), runListAdminCountries()])
  return (
    <section className="space-y-6">
      <header className="border-b border-outline-variant pb-6">
        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Taxonomy
        </span>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl">Regions & Countries</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
          Manage geographic regions and their countries. Regions organize countries for the map
          filter; countries link to spots and events.
        </p>
      </header>
      <RegionManager initialRegions={regions} initialCountries={countries} />
    </section>
  )
}
