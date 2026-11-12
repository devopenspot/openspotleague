import type { FlagDefinition } from "./definition"

/**
 * Feature flags: only for big features (docs/feature-flags.md). Add one with
 * an owner and a `removeBy` date at most three months out, defaults on for
 * local and develop, off for production:
 *
 *   leagueVideoJudging: defineFlag({   // import { defineFlag } from "./definition"
 *     description: "Video judging for League contests",
 *     owner: "devopenspot",
 *     removeBy: "2027-02-01",
 *     defaults: { local: true, develop: true, production: false },
 *   }),
 *
 * Delete the entry (and the off path) once it has been at 100 % in production
 * for a release. Keep about five flags live at most.
 */
export const FLAGS = {
  // No live flags yet.
} as const satisfies Record<string, FlagDefinition>

export type FlagKey = keyof typeof FLAGS

export const FLAG_KEYS = Object.keys(FLAGS) as FlagKey[]

export function isFlagKey(value: string): value is FlagKey {
  return Object.prototype.hasOwnProperty.call(FLAGS, value)
}
