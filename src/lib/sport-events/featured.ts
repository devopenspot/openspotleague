import type { SportEventEnriched } from "@/types/sport-events";

/**
 * Select the directory hero from an already-enriched list. Completed events
 * are never promoted as the default hero.
 */
export function selectFeaturedEvent(
  events: readonly SportEventEnriched[],
): SportEventEnriched | undefined {
  return (
    events.find((event) => event.featured && event.status !== "completed") ??
    events.find((event) => event.status !== "completed")
  );
}
