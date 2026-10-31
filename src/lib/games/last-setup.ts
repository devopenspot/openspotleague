import { z } from "zod"
import { ruleModeSchema, trickLevelSchema } from "@/lib/schemas/game"

const STORAGE_PREFIX = "openspot:game-setup:v1:"

const lastSetupSchema = z.object({
  ruleMode: ruleModeSchema,
  level: trickLevelSchema,
  spotType: z.string().min(1),
  categories: z.array(z.string()),
})

export type LastSetup = z.infer<typeof lastSetupSchema>

/**
 * The settings a rider last played with, per discipline, so starting again
 * takes one tap. Kept apart from `preferredSport`, which also drives the map
 * and TV filters and is synced to the account.
 */
export function loadLastSetup(discipline: string): LastSetup | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${discipline}`)
    if (!raw) return null
    const parsed = lastSetupSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function saveLastSetup(discipline: string, setup: LastSetup) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${discipline}`,
      JSON.stringify(setup),
    )
  } catch {
    // Private browsing and full storage just mean the defaults next time.
  }
}
