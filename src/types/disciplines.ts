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
