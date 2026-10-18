import type { SportEventCategory } from "@/types/sport-events"

export const EVENT_CATEGORY_OPTIONS: readonly {
  value: SportEventCategory
  label: string
}[] = [
  { value: "world-tour", label: "World Tour" },
  { value: "championship", label: "Championship" },
  { value: "festival", label: "Festival" },
  { value: "federation", label: "Federation" },
  { value: "local-event", label: "Local Event" },
]

export const EVENT_CATEGORY_LABELS: Readonly<Record<SportEventCategory, string>> =
  Object.fromEntries(
    EVENT_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<SportEventCategory, string>
