import { cacheLife, cacheTag, revalidatePath, revalidateTag } from "next/cache"
import { getAdminRegionRepositoryAsync } from "@/lib/repositories"
import type { AdminRegion, AdminCountry, AdminRegionPatch, AdminCountryPatch } from "@/lib/repositories/admin/admin-region-repository"
import { LIST_CACHE_LIFE } from "@/lib/cache/lifetimes"

function revalidateRegionsPaths() {
  revalidateTag("regions:all", LIST_CACHE_LIFE)
  revalidateTag("countries:all", LIST_CACHE_LIFE)
  revalidateTag("spots:list", LIST_CACHE_LIFE)
  revalidateTag("events:list", LIST_CACHE_LIFE)
  revalidatePath("/admin/taxonomy/regions")
  revalidatePath("/map")
}

export async function runListAdminRegions(): Promise<readonly AdminRegion[]> {
  return (await getAdminRegionRepositoryAsync()).listRegions()
}

export async function listAdminRegions(): Promise<readonly AdminRegion[]> {
  "use cache"
  cacheTag("regions:all")
  cacheLife(LIST_CACHE_LIFE)
  return runListAdminRegions()
}

export async function runListAdminCountries(): Promise<readonly AdminCountry[]> {
  return (await getAdminRegionRepositoryAsync()).listCountries()
}

export async function listAdminCountries(): Promise<readonly AdminCountry[]> {
  "use cache"
  cacheTag("countries:all")
  cacheLife(LIST_CACHE_LIFE)
  return runListAdminCountries()
}

export async function createRegion(input: {
  slug: string
  name: string
  description?: string
  imageUrl?: string | null
  sortOrder?: number
}): Promise<AdminRegion> {
  const result = await (await getAdminRegionRepositoryAsync()).createRegion(input)
  revalidateRegionsPaths()
  return result
}

export async function updateRegion(id: string, patch: AdminRegionPatch): Promise<AdminRegion> {
  const result = await (await getAdminRegionRepositoryAsync()).updateRegion(id, patch)
  revalidateRegionsPaths()
  return result
}

export async function deleteRegion(id: string): Promise<void> {
  await (await getAdminRegionRepositoryAsync()).deleteRegion(id)
  revalidateRegionsPaths()
}

export async function createCountry(input: {
  iso2: string
  name: string
  iso3?: string | null
  regionId: string
}): Promise<AdminCountry> {
  const result = await (await getAdminRegionRepositoryAsync()).createCountry(input)
  revalidateRegionsPaths()
  return result
}

export async function updateCountry(iso2: string, patch: AdminCountryPatch): Promise<AdminCountry> {
  const result = await (await getAdminRegionRepositoryAsync()).updateCountry(iso2, patch)
  revalidateRegionsPaths()
  return result
}

export async function deleteCountry(iso2: string): Promise<void> {
  await (await getAdminRegionRepositoryAsync()).deleteCountry(iso2)
  revalidateRegionsPaths()
}
