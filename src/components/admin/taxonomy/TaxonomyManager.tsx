"use client";

import type { TaxonomyEntry, TrickCatalog } from "@/lib/repositories/taxonomy/taxonomy-repository";
import { SportsSection } from "./sports/SportsSection";
import { SpotTypesSection } from "./spots/SpotTypesSection";
import { TrickCatalogSection } from "./trick/TrickCatalogSection";

type Section = "sports" | "spot-types" | "tricks";

/**
 * Facade that preserves the public API while delegating to focused section components.
 * Previously a single 862-line god component handling 3 domains with duplicated
 * `request`/`pendingActions` logic — now split into 3 single-responsibility
 * modules sharing `usePendingActions` + `adminRequest`.
 */
export function TaxonomyManager({
  section,
  sports,
  spotTypes,
  catalogs,
}: {
  section: Section;
  sports: readonly TaxonomyEntry[];
  spotTypes: readonly TaxonomyEntry[];
  catalogs: readonly TrickCatalog[];
}) {
  if (section === "sports") return <SportsSection sports={sports} />;
  if (section === "spot-types") return <SpotTypesSection spotTypes={spotTypes} />;
  if (section === "tricks")
    return <TrickCatalogSection sports={sports} spotTypes={spotTypes} catalogs={catalogs} />;
  return null;
}
