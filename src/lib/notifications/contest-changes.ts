/**
 * Which member-facing contest fields an edit actually changed — drives the
 * `league_contest_updated` notification. Pure: compares the pre-edit
 * snapshot with the values about to be written (undefined = untouched), so
 * re-saving the same values notifies nobody.
 */

import type { ContestChangeField } from "@/types/league"

export interface ContestChangeSnapshot {
  startAt: Date
  endAt: Date | null
  timezone: string | null
  submissionDeadlineAt: Date | null
  city: string | null
  address: string | null
  venue: string | null
  countryCode: string | null
  location: { lat: number; lon: number } | null
}

export type ContestChangePatch = {
  [K in keyof ContestChangeSnapshot]?: ContestChangeSnapshot[K]
}

/** Patch keys that can touch location (caller loads the snapshot only then). */
export const LOCATION_PATCH_KEYS: ReadonlySet<string> = new Set([
  "city",
  "citySlug",
  "address",
  "countryCode",
  "country",
  "venue",
  "latitude",
  "longitude",
])

function sameTime(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null)
}

function changed<K extends keyof ContestChangeSnapshot>(
  before: ContestChangeSnapshot,
  patch: ContestChangePatch,
  key: K,
): boolean {
  if (!(key in patch) || patch[key] === undefined) return false
  const next = patch[key]
  const prev = before[key]
  if (next instanceof Date || prev instanceof Date) {
    return !sameTime(prev as Date | null, next as Date | null)
  }
  if (key === "location") {
    const a = prev as ContestChangeSnapshot["location"]
    const b = next as ContestChangeSnapshot["location"]
    return (a?.lat ?? null) !== (b?.lat ?? null) || (a?.lon ?? null) !== (b?.lon ?? null)
  }
  return (prev ?? null) !== (next ?? null)
}

export function detectContestChanges(
  before: ContestChangeSnapshot,
  patch: ContestChangePatch,
): ContestChangeField[] {
  const fields: ContestChangeField[] = []
  if (
    changed(before, patch, "startAt") ||
    changed(before, patch, "endAt") ||
    changed(before, patch, "timezone")
  ) {
    fields.push("schedule")
  }
  if (
    changed(before, patch, "city") ||
    changed(before, patch, "address") ||
    changed(before, patch, "venue") ||
    changed(before, patch, "countryCode") ||
    changed(before, patch, "location")
  ) {
    fields.push("location")
  }
  if (changed(before, patch, "submissionDeadlineAt")) fields.push("deadline")
  return fields
}
