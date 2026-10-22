import { GAME_DEFINITIONS, type GameDefinition } from "@/lib/games/definitions"
import type { DisciplineSlug } from "@/lib/schemas/game"
import type { SportDiscipline, SportPreference } from "@/types/sport-events"

export const DISCIPLINE_META: Record<DisciplineSlug, { name: string; eliminationWord: string }> = {
  roller: { name: GAME_DEFINITIONS.roller.sportPreference, eliminationWord: GAME_DEFINITIONS.roller.eliminationWord },
  skateboard: { name: GAME_DEFINITIONS.skateboard.sportPreference, eliminationWord: GAME_DEFINITIONS.skateboard.eliminationWord },
  bmx: { name: GAME_DEFINITIONS.bmx.sportPreference, eliminationWord: GAME_DEFINITIONS.bmx.eliminationWord },
  scooter: { name: GAME_DEFINITIONS.scooter.sportPreference, eliminationWord: GAME_DEFINITIONS.scooter.eliminationWord },
}

export const DISCIPLINE_TO_SPORT: Record<DisciplineSlug, SportDiscipline> = {
  roller: "Roller",
  skateboard: "Skateboard",
  bmx: "BMX",
  scooter: "Scooter",
}

export const SPORT_TO_DISCIPLINE: Record<SportDiscipline, DisciplineSlug> = {
  Roller: "roller",
  Skateboard: "skateboard",
  BMX: "bmx",
  Scooter: "scooter",
}

/**
 * Resolves the user's single selected sport into a game discipline.
 * Returns null if the user has no preference or has selected "all disciplines".
 */
export function resolveGameDiscipline(preferredSport: SportPreference | null): DisciplineSlug | null {
  if (!preferredSport || preferredSport === "all") return null;
  return SPORT_TO_DISCIPLINE[preferredSport];
}

export { GAME_DEFINITIONS, type GameDefinition, type DisciplineSlug }
