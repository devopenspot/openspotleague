import { NextResponse } from "next/server"
import { authorizationErrorResponse, requireAdministrator } from "@/lib/auth/server"
import { getSpotRepositoryAsync } from "@/lib/repositories"
import { getTaxonomyRepositoryAsync } from "@/lib/repositories"

export async function GET() {
  try { await requireAdministrator() } catch (e) { return authorizationErrorResponse(e) }
  const [spotRepo, taxRepo] = await Promise.all([getSpotRepositoryAsync(), getTaxonomyRepositoryAsync()])
  const [{ items: countryRows }, disciplineRows] = await Promise.all([spotRepo.listAllCountries(), taxRepo.listSports()])
  const countries = countryRows.map((r) => ({ iso2: r.iso2, name: r.name, region: r.region }))
  const disciplines = disciplineRows.map((r) => ({ slug: r.slug, name: r.name }))
  return NextResponse.json({ countries, disciplines })
}
