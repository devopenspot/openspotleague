import countriesRaw from "@/data/countries.json";
import regionsRaw from "@/data/regions.json";
import citiesRaw from "@/data/cities.json";

export interface CountrySeed {
  iso2: string;
  name: string;
  iso3: string;
  region: string;
}

export interface CountryWithCitiesSeed {
  iso2: string;
  name: string;
  iso3: string;
  region: string;
  cities: readonly string[];
}

const regionNameBySlug = new Map<string, string>();
for (const region of regionsRaw) {
  regionNameBySlug.set(region.slug, region.name);
}

const citiesByCountryCode = new Map<string, string[]>();
for (const city of citiesRaw) {
  if (city.featured) {
    const list = citiesByCountryCode.get(city.country_code);
    if (list) list.push(city.name);
    else citiesByCountryCode.set(city.country_code, [city.name]);
  }
}

export function buildCountrySeed(): readonly CountrySeed[] {
  return countriesRaw.map((country) => ({
    iso2: country.iso2,
    name: country.name,
    iso3: country.iso3 || "",
    region: regionNameBySlug.get(country.region_slug) ?? country.region_slug,
  }));
}

export function buildCountryWithCitiesSeed(): readonly CountryWithCitiesSeed[] {
  return countriesRaw.map((country) => ({
    iso2: country.iso2,
    name: country.name,
    iso3: country.iso3 || "",
    region: regionNameBySlug.get(country.region_slug) ?? country.region_slug,
    cities: citiesByCountryCode.get(country.iso2) ?? [],
  }));
}
