import { z } from "zod";
import regionsRaw from "@/data/regions.json";
import countriesRaw from "@/data/countries.json";
import citiesRaw from "@/data/cities.json";

export interface RegionSeedCountry {
  name: string;
  cities: readonly string[];
}

export interface RegionSeed {
  name: string;
  slug: string;
  desc: string;
  image: string;
  sortOrder: number;
  countries: readonly RegionSeedCountry[];
}

export interface CitySeed {
  countryCode: string;
  slug: string;
  name: string;
  sortOrder: number;
  featured: boolean;
}

const RegionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  image_url: z.string(),
  sort_order: z.number().int().nonnegative(),
});

const CountrySchema = z.object({
  iso2: z.string().length(2),
  iso3: z.string(),
  name: z.string().min(1),
  region_slug: z.string().min(1),
});

const CitySchema = z.object({
  country_code: z.string().length(2),
  slug: z.string().min(1),
  name: z.string().min(1),
  sort_order: z.number().int().nonnegative(),
  featured: z.boolean().default(false),
});

const rawRegions = z.array(RegionSchema).parse(regionsRaw);
const rawCountries = z.array(CountrySchema).parse(countriesRaw);
const rawCities = z.array(CitySchema).parse(citiesRaw);

export const CITY_SEED: readonly CitySeed[] = rawCities.map((c) => ({
  countryCode: c.country_code,
  slug: c.slug,
  name: c.name,
  sortOrder: c.sort_order,
  featured: c.featured,
}));

// Build cities by country for RegionSeed compatibility
const citiesByIso2 = new Map<string, string[]>();
for (const city of rawCities) {
  if (city.featured) {
    const list = citiesByIso2.get(city.country_code);
    if (list) list.push(city.name);
    else citiesByIso2.set(city.country_code, [city.name]);
  }
}

// Build countries by region slug
const countriesByRegion = new Map<string, RegionSeedCountry[]>();
for (const country of rawCountries) {
  const cities = citiesByIso2.get(country.iso2) ?? [];
  const list = countriesByRegion.get(country.region_slug);
  const entry: RegionSeedCountry = { name: country.name, cities };
  if (list) list.push(entry);
  else countriesByRegion.set(country.region_slug, [entry]);
}

export const REGION_SEED: readonly RegionSeed[] = rawRegions.map((region) => ({
  name: region.name,
  slug: region.slug,
  desc: region.description,
  image: region.image_url,
  sortOrder: region.sort_order,
  countries: countriesByRegion.get(region.slug) ?? [],
}));
