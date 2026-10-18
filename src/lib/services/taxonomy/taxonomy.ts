import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache"
import { getTaxonomyRepositoryAsync } from "@/lib/repositories"
import type { TaxonomyEntry, TaxonomyPatch } from "@/lib/repositories/taxonomy/taxonomy-repository"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

export async function runListSports() { return (await getTaxonomyRepositoryAsync()).listSports() }
export async function listSports() { "use cache"; cacheTag("sports:all"); cacheLife(LIST_CACHE_LIFE); return runListSports() }
export async function runListEventCategories() { return (await getTaxonomyRepositoryAsync()).listEventCategories() }
export async function listEventCategories() { "use cache"; cacheTag("event-categories:all"); cacheLife(LIST_CACHE_LIFE); return runListEventCategories() }
export async function runListAdminTaxonomy() {
  const repo = await getTaxonomyRepositoryAsync()
  const [sports, spotTypes, eventCategories] = await Promise.all([
    repo.listSports(),
    repo.listSpotTypes(),
    repo.listEventCategories(),
  ])
  return { sports, spotTypes, eventCategories }
}
export async function listAdminTaxonomy() { "use cache"; cacheTag("sports:all", "spot-types:all", "event-categories:all"); cacheLife(LIST_CACHE_LIFE); return runListAdminTaxonomy() }

export async function updateSport(slug: string, patch: TaxonomyPatch): Promise<TaxonomyEntry> {
  const result = await (await getTaxonomyRepositoryAsync()).updateSport(slug, patch)
  revalidateTag("sports:all", LIST_CACHE_LIFE); revalidateTag("spots:list", LIST_CACHE_LIFE); revalidateTag("events:list", LIST_CACHE_LIFE); revalidateTag("directory:common", LIST_CACHE_LIFE)
  revalidatePath("/admin/taxonomy/sports")
  return result
}
export async function deleteSport(slug: string): Promise<void> {
  await (await getTaxonomyRepositoryAsync()).deleteSport(slug)
  revalidateTag("sports:all", LIST_CACHE_LIFE); revalidateTag("spots:list", LIST_CACHE_LIFE); revalidateTag("events:list", LIST_CACHE_LIFE); revalidateTag("directory:common", LIST_CACHE_LIFE)
  revalidatePath("/admin/taxonomy/sports")
}
export async function createSpotType(input: TaxonomyEntry): Promise<TaxonomyEntry> {
  const result = await (await getTaxonomyRepositoryAsync()).createSpotType(input)
  revalidateTaxonomyPaths(); return result
}
export async function updateSpotType(slug: string, patch: TaxonomyPatch): Promise<TaxonomyEntry> {
  const result = await (await getTaxonomyRepositoryAsync()).updateSpotType(slug, patch)
  revalidateTaxonomyPaths(); return result
}
export async function deleteSpotType(slug: string): Promise<void> {
  await (await getTaxonomyRepositoryAsync()).deleteSpotType(slug)
  revalidateTaxonomyPaths()
}
function revalidateTaxonomyPaths() {
  revalidateTag("spot-types:all", LIST_CACHE_LIFE); revalidateTag("spots:list", LIST_CACHE_LIFE); revalidateTag("spots:nearby", LIST_CACHE_LIFE); revalidateTag("directory:common", LIST_CACHE_LIFE); revalidateTag("spots:home", LIST_CACHE_LIFE)
  revalidatePath("/admin/taxonomy/spot-types"); revalidatePath("/admin/spots"); revalidatePath("/map")
}
