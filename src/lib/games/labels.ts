import type { GameMode } from "@/lib/schemas/game"

/**
 * Rider-facing names for game enums. UI never prints a raw status or result
 * slug; it reads them through these maps so the wording stays in one place.
 * Game status wording depends on the mode (an ended training is "Finished"),
 * so it lives in `match-labels.ts`.
 */
export const GAME_MODE_LABEL: Record<GameMode, string> = {
  training: "Training",
  challenge: "Battle",
}

export const PLAYER_STATUS_LABEL: Record<"active" | "eliminated" | "left", string> = {
  active: "Riding",
  eliminated: "Out",
  left: "Left",
}

export const ATTEMPT_RESULT_LABEL: Record<"pending" | "landed" | "failed", string> = {
  pending: "Pending",
  landed: "Landed",
  failed: "Missed",
}

/** "partly_cloudy" → "Partly cloudy". */
export function weatherLabel(icon: string): string {
  const words = icon.replaceAll(/[_-]/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
