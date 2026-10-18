import { TaxonomyManager } from "@/components/admin/taxonomy/TaxonomyManager"
import { connection } from "next/server"
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { requireAdministratorOrRedirect } from "@/lib/auth/server"

export const metadata = { title: "Admin · Spot types" }

export default async function AdminSpotTypesPage() {
  await connection()
  await requireAdministratorOrRedirect("/admin/taxonomy/spot-types")
  const { sports, spotTypes } = await runListAdminTaxonomy()
  return <section className="space-y-6"><header className="border-b border-outline-variant pb-5"><span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">Taxonomy</span><h1 className="font-display text-3xl font-bold uppercase">Spot types</h1><p className="mt-2 text-xs text-secondary">Manage the location categories assigned to spots and challenge compatibility.</p></header><TaxonomyManager section="spot-types" sports={sports} spotTypes={spotTypes} catalogs={[]} /></section>
}
