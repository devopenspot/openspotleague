import { GAME_MODE_LABEL } from "@/lib/games/labels"
import type { GameListItem } from "@/lib/schemas/game"

/**
 * Rider-facing wording for a game in the match history.
 *
 * The DB status is a lifecycle state, not copy: a training the rider ends is
 * stored as `cancelled`, but for the rider it is finished. Only a battle that
 * closes before anyone wins (closed early or expired) reads "Ended early".
 */
type MatchLabelInput = Pick<GameListItem, "mode" | "status">

export type MatchStatusTone = "live" | "waiting" | "done"

export function matchStatusLabel({ mode, status }: MatchLabelInput): string {
  switch (status) {
    case "lobby":
      return mode === "challenge" ? "Waiting for riders" : "Not started"
    case "active":
      return "In progress"
    case "complete":
      return "Finished"
    case "cancelled":
      return mode === "challenge" ? "Ended early" : "Finished"
  }
}

export function matchStatusTone({ status }: Pick<GameListItem, "status">): MatchStatusTone {
  if (status === "active") return "live"
  if (status === "lobby") return "waiting"
  return "done"
}

export function matchModeLabel(mode: GameListItem["mode"]): string {
  return GAME_MODE_LABEL[mode]
}

/** `manual_pads` → `Manual pads`. */
export function spotTypeLabel(slug: string): string {
  const words = slug.replace(/[_-]+/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** "Battle · Downtown Plaza · Rails" / "Training · Rails". Never shows ids. */
export function matchMetaLine(
  game: Pick<GameListItem, "mode" | "spotLabel" | "spotName" | "nextSpotType">,
): string {
  const parts = [matchModeLabel(game.mode)]
  // Registered spot name first, then a training's free-text place.
  const place = game.spotName ?? game.spotLabel
  if (place) parts.push(place)
  else if (game.mode === "challenge") parts.push("Registered spot")
  parts.push(spotTypeLabel(game.nextSpotType))
  return parts.join(" · ")
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
const SHORT_DATE_TIME: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
}

/** Scheduled start when there is one, otherwise when the game last moved. */
export function matchDateLine(
  game: Pick<GameListItem, "scheduledStartAt" | "updatedAt" | "status">,
  locale?: string,
): string {
  if (game.scheduledStartAt && game.status === "lobby") {
    return `Starts ${new Date(game.scheduledStartAt).toLocaleString(locale, SHORT_DATE_TIME)}`
  }
  const when = new Date(game.updatedAt).toLocaleDateString(locale, SHORT_DATE)
  return game.status === "active" || game.status === "lobby"
    ? `Updated ${when}`
    : `Played ${when}`
}
