import { START_GRACE_MINUTES } from "./definitions"

export const TRAINING_GAME_LIMIT = 3
export const TRAINING_GAME_INACTIVITY_MS = 10 * 60 * 1000
export const CHALLENGE_GAME_INACTIVITY_MS = 60 * 60 * 1000
export const CHALLENGE_LOBBY_GRACE_MS = START_GRACE_MINUTES * 60 * 1000

export function trainingGameExpiry(now: Date): Date {
  return new Date(now.getTime() - TRAINING_GAME_INACTIVITY_MS)
}

export function isTrainingGameExpired(updatedAt: Date, now: Date): boolean {
  return updatedAt < trainingGameExpiry(now)
}

export function challengeLobbyExpiry(now: Date): Date {
  return new Date(now.getTime() - CHALLENGE_LOBBY_GRACE_MS)
}

export function challengeActiveExpiry(now: Date): Date {
  return new Date(now.getTime() - CHALLENGE_GAME_INACTIVITY_MS)
}

export function isChallengeGameExpired(
  game: {
    status: "lobby" | "active" | "complete" | "cancelled"
    scheduledStartAt: Date | null
    updatedAt: Date
  },
  now: Date,
): boolean {
  if (game.status === "lobby") {
    const anchor = game.scheduledStartAt ?? game.updatedAt
    return anchor < challengeLobbyExpiry(now)
  }
  if (game.status === "active") {
    return game.updatedAt < challengeActiveExpiry(now)
  }
  return false
}
