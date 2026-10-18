import Link from "next/link";
import { Plus } from "lucide-react";
import { connection } from "next/server";
import { requireSpotCurationRoleOrRedirect } from "@/lib/auth/server";
import { runListSpots } from "@/lib/services/spot/spots";
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy";
import { toSportOptions } from "@/lib/admin/taxonomy";
import { SpotTable } from "@/components/admin/spots/table/SpotTable";
import { SpotTableFilters } from "@/components/admin/spots/table/SpotTableFilters";
import type { SportDiscipline } from "@/types/sport-events";

interface AdminSpotsPageProps {
  searchParams: Promise<{
    q?: string;
    /**
     * CSV of type slugs. Matched with OR semantics by the repository
     * (a spot matches if it carries at least one of these types).
     * Backed by the `spot_type_assignments` join table.
     */
    type?: string;
    country?: string;
    sport?: string;
    cursor?: string;
  }>;
}

export const metadata = {
  title: "Admin · Spots",
};

function parseTypesParam(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  const list = Array.from(
    new Set(
      value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    ),
  );
  return list.length > 0 ? list : undefined;
}

function parseSportParam(value: string | undefined): SportDiscipline | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  const option = ["Skateboard", "BMX", "Scooter", "Roller"].find(
    (sport) => sport.toLowerCase() === normalized,
  );
  return option as SportDiscipline | undefined;
}

export default async function AdminSpotsPage({
  searchParams,
}: AdminSpotsPageProps) {
  await connection();
  await requireSpotCurationRoleOrRedirect("/admin/spots");
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const types = parseTypesParam(params.type);
  const country = (params.country ?? "").trim();
  const discipline = parseSportParam(params.sport);
  const cursor = (params.cursor ?? "").trim() || undefined;

  const resultPromise = runListSpots({
    q: q || undefined,
    types,
    country: country || undefined,
    discipline,
    cursor,
    limit: 100,
    includeHidden: true,
  });
  const taxonomyPromise = runListAdminTaxonomy();
  const [result, taxonomy] = await Promise.all([resultPromise, taxonomyPromise]);
  const sportOptions = toSportOptions(taxonomy.sports);

  return (
    <section
      id="admin-spots"
      aria-labelledby="admin-spots-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Catalogue
          </span>
          <h1
            id="admin-spots-heading"
            className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl"
          >
            Spots
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {result.items.length} shown{result.nextCursor ? "+" : ""}.
          </p>
        </div>
        <Link
          href="/admin/spots/new"
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
        >
          <Plus size={13} aria-hidden="true" />
          New spot
        </Link>
      </header>

      <SpotTableFilters sportOptions={sportOptions} />
      <SpotTable spots={result.items} nextCursor={result.nextCursor} />
    </section>
  );
}
