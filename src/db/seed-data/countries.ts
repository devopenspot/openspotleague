import { COUNTRY_TO_ISO2, COUNTRY_TO_ISO3 } from "./iso-codes"
import { REGION_SEED } from "./regions"

export interface CountrySeed {
  iso2: string
  name: string
  iso3: string
  region: string
}

export function buildCountrySeed(): readonly CountrySeed[] {
  const out: CountrySeed[] = []
  for (const region of REGION_SEED) {
    for (const country of region.countries) {
      const iso2 = COUNTRY_TO_ISO2[country.name]
      if (!iso2) continue
      out.push({
        iso2,
        name: country.name,
        iso3: COUNTRY_TO_ISO3[iso2] ?? "",
        region: region.name,
      })
    }
  }
  return out
}

export interface CountryWithCitiesSeed {
  iso2: string
  name: string
  iso3: string
  region: string
  cities: readonly string[]
}

export function buildCountryWithCitiesSeed(): readonly CountryWithCitiesSeed[] {
  const out: CountryWithCitiesSeed[] = []
  for (const region of REGION_SEED) {
    for (const country of region.countries) {
      const iso2 = COUNTRY_TO_ISO2[country.name]
      if (!iso2) continue
      out.push({
        iso2,
        name: country.name,
        iso3: COUNTRY_TO_ISO3[iso2] ?? "",
        region: region.name,
        cities: country.cities,
      })
    }
  }
  return out
}
