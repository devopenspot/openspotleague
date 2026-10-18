export interface AdminRegion {
  id: string
  slug: string
  name: string
  description: string
  imageUrl: string | null
  sortOrder: number
  countryCount: number
}

export interface AdminCountry {
  iso2: string
  name: string
  iso3: string | null
  regionId: string
  regionName: string
  spotCount: number
  eventCount: number
}

export interface AdminRegionPatch {
  name?: string
  slug?: string
  description?: string
  imageUrl?: string | null
  sortOrder?: number
}

export interface AdminCountryPatch {
  name?: string
  iso3?: string | null
  regionId?: string
}

export interface AdminRegionRepository {
  listRegions(): Promise<readonly AdminRegion[]>
  createRegion(input: { slug: string; name: string; description?: string; imageUrl?: string | null; sortOrder?: number }): Promise<AdminRegion>
  updateRegion(id: string, patch: AdminRegionPatch): Promise<AdminRegion>
  deleteRegion(id: string): Promise<void>
  listCountries(): Promise<readonly AdminCountry[]>
  createCountry(input: { iso2: string; name: string; iso3?: string | null; regionId: string }): Promise<AdminCountry>
  updateCountry(iso2: string, patch: AdminCountryPatch): Promise<AdminCountry>
  deleteCountry(iso2: string): Promise<void>
}
