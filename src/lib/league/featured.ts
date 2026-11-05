import type { ContestEnriched } from "@/types/league";

/**
 * Select the directory hero from an already-enriched list. Completed events
 * are never promoted as the default hero.
 */
export function selectFeaturedEvent(
  events: readonly ContestEnriched[],
): ContestEnriched | undefined {
  return (
    events.find((event) => event.featured && event.status !== "completed") ??
    events.find((event) => event.status !== "completed")
  );
}
