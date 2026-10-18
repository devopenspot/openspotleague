import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache"
import { getTaxonomyRepositoryAsync } from "@/lib/repositories"
import type {
  TrickCatalogEntry,
  TrickMutationOptions,
} from "@/lib/repositories/taxonomy/taxonomy-repository"
import { LIST_CACHE_LIFE as CACHE_LIFE } from "@/lib/cache/lifetimes"

export async function runListCurrentTrickCatalogs() {
  return (await getTaxonomyRepositoryAsync()).listCurrentTrickCatalogs()
}

export async function listCurrentTrickCatalogs() {
  "use cache"
  cacheTag("trick-catalogs:current")
  cacheLife(CACHE_LIFE)
  return runListCurrentTrickCatalogs()
}

function revalidateTrickCatalog(disciplineSlug: string) {
  revalidateTag("trick-catalogs:current", CACHE_LIFE)
  revalidateTag(`games:catalog:${disciplineSlug}`, CACHE_LIFE)
  revalidatePath("/admin/taxonomy/tricks")
}

export async function saveTrick(
  disciplineSlug: string,
  trick: TrickCatalogEntry,
  options?: TrickMutationOptions,
) {
  const result = await (await getTaxonomyRepositoryAsync()).saveTrick(disciplineSlug, trick, options)
  revalidateTrickCatalog(disciplineSlug)
  return result
}

export async function deleteTrick(
  disciplineSlug: string,
  sourceId: string,
  options?: TrickMutationOptions,
) {
  await (await getTaxonomyRepositoryAsync()).deleteTrick(disciplineSlug, sourceId, options)
  revalidateTrickCatalog(disciplineSlug)
}
