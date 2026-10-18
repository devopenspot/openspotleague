import { TaxonomyManager } from "@/components/admin/taxonomy/TaxonomyManager"
import { connection } from "next/server"
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { requireAdministratorOrRedirect } from "@/lib/auth/server"

export const metadata = { title: "Admin · Sports" }

export default async function AdminSportsPage() {
  await connection()
  await requireAdministratorOrRedirect("/admin/taxonomy/sports")
  const { sports, spotTypes } = await runListAdminTaxonomy()
  return <TaxonomyPage title="Sports" description="Edit the discipline labels used across spots, events, and challenges." section="sports" sports={sports} spotTypes={spotTypes} catalogs={[]} />
}

function TaxonomyPage(props: React.ComponentProps<typeof TaxonomyManager> & { title: string; description: string }) {
  return <section className="space-y-6"><header className="border-b border-outline-variant pb-5"><span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">Taxonomy</span><h1 className="font-display text-3xl font-bold uppercase">{props.title}</h1><p className="mt-2 text-xs text-secondary">{props.description}</p></header><TaxonomyManager {...props} /></section>
}
