import { z } from "zod";
import countriesRaw from "@/data/countries.json";

const CountryEntrySchema = z.object({
  iso2: z.string().length(2),
  iso3: z.string().max(3),
  name: z.string().min(1),
  region_slug: z.string().min(1),
  aliases: z.array(z.string()).default([]),
});

const countries = z.array(CountryEntrySchema).parse(countriesRaw);

const iso2Map: Record<string, string> = {};
const iso3Map: Record<string, string> = {};
const overridesMap: Record<string, string> = {};

for (const country of countries) {
  iso2Map[country.name] = country.iso2;
  if (country.iso3) {
    iso3Map[country.iso2] = country.iso3;
  }
  for (const alias of country.aliases) {
    overridesMap[alias] = country.name;
    iso2Map[alias] = country.iso2;
  }
}

export const COUNTRY_TO_ISO2: Readonly<Record<string, string>> = iso2Map;
export const COUNTRY_TO_ISO3: Readonly<Record<string, string>> = iso3Map;
export const COUNTRY_NAME_OVERRIDES: Readonly<Record<string, string>> = overridesMap;
