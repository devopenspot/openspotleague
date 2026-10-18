import { TaxonomyManager } from "@/components/admin/taxonomy/TaxonomyManager";
import { connection } from "next/server";
import { requireTrickCurationRoleOrRedirect } from "@/lib/auth/server";
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy";
import { runListCurrentTrickCatalogs } from "@/lib/services/taxonomy/trick-catalogs";

export const metadata = { title: "Admin · Tricks" };

export default async function AdminTricksPage() {
  await connection();
  await requireTrickCurationRoleOrRedirect("/admin/taxonomy/tricks");
  const { sports, spotTypes } = await runListAdminTaxonomy();
  const catalogs = await runListCurrentTrickCatalogs();
  return (
    <section className="space-y-6">
      <header className="border-b border-outline-variant pb-6">
        <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Taxonomy
        </span>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl">Tricks</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
          Save each trick individually. Existing games keep their current catalog snapshot.
        </p>
      </header>
      <TaxonomyManager
        section="tricks"
        sports={sports}
        spotTypes={spotTypes}
        catalogs={catalogs}
      />
    </section>
  );
}
