export type SportDiscipline = "Skateboard" | "BMX" | "Scooter" | "Roller";

export const SPORT_DISCIPLINES: readonly SportDiscipline[] = [
  "Skateboard",
  "BMX",
  "Scooter",
  "Roller",
] as const;

export type SportPreference = SportDiscipline | "all";

export const SPORT_PREFERENCES: readonly SportPreference[] = [
  "all",
  ...SPORT_DISCIPLINES,
] as const;

/** Store value (`"BMX"`, `"all"`) → API `disciplineSlug` (`"bmx"`, `"all"`). */
export function sportPreferenceToSlug(sport: SportPreference | null): string | null {
  if (sport === "all") return "all";
  return sport ? sport.toLowerCase() : null;
}

/** API `disciplineSlug` → store value; unknown slugs read as no preference. */
export function sportPreferenceFromSlug(slug: string | null | undefined): SportPreference | null {
  if (slug === "all") return "all";
  return SPORT_DISCIPLINES.find((sport) => sport.toLowerCase() === slug) ?? null;
}
