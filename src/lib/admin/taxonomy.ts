import type { TaxonomyEntry } from "@/lib/repositories/taxonomy/taxonomy-repository"
import {
  SPORT_DISCIPLINES,
  type SportDiscipline,
  type SportEventCategory,
} from "@/types/sport-events"

export interface SportOption {
  value: SportDiscipline
  label: string
}

export interface EventCategoryOption {
  value: SportEventCategory
  label: string
}

const SPORT_SLUGS: Readonly<Record<string, SportDiscipline>> = {
  skateboard: "Skateboard",
  bmx: "BMX",
  scooter: "Scooter",
  roller: "Roller",
}

const DEFAULT_SPORT_OPTIONS: readonly SportOption[] = SPORT_DISCIPLINES.map(
  (value) => ({ value, label: value }),
)

const DEFAULT_EVENT_CATEGORY_OPTIONS: readonly EventCategoryOption[] = [
  { value: "world-tour", label: "World Tour" },
  { value: "championship", label: "Championship" },
  { value: "festival", label: "Festival" },
  { value: "federation", label: "Federation" },
  { value: "local-event", label: "Local Event" },
]

export function toSportOptions(
  entries: readonly TaxonomyEntry[],
): readonly SportOption[] {
  const options = entries.flatMap((entry) => {
    const value = SPORT_SLUGS[entry.slug.toLowerCase()]
    return value ? [{ value, label: entry.name }] : []
  })
  return options.length > 0 ? options : DEFAULT_SPORT_OPTIONS
}

export function toEventCategoryOptions(
  entries: readonly TaxonomyEntry[],
): readonly EventCategoryOption[] {
  const options = entries.flatMap((entry) => {
    if (!DEFAULT_EVENT_CATEGORY_OPTIONS.some((option) => option.value === entry.slug)) {
      return []
    }
    return [{ value: entry.slug as SportEventCategory, label: entry.name }]
  })
  return options.length > 0 ? options : DEFAULT_EVENT_CATEGORY_OPTIONS
}
