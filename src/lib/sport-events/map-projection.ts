import type { MapEvent, SportEventEnriched } from "@/types/sport-events";

export function projectMapEvent(event: SportEventEnriched): MapEvent | null {
  const { latitude, longitude } = event.location;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    shortName: event.shortName,
    city: event.location.city,
    citySlug: event.location.citySlug,
    country: event.location.country,
    category: event.category,
    categoryName: event.categoryName,
    status: event.status,
    dateRangeLabel: event.dateRangeLabel,
    startDate: event.startDate,
    endDate: event.endDate,
    url: event.url,
    lat: latitude,
    lon: longitude,
  };
}

/**
 * Keep the map payload bounded after projection. Events without coordinates
 * remain valid directory records but cannot consume marker capacity.
 */
export function projectMapEvents(
  events: readonly SportEventEnriched[],
  limit: number,
): readonly MapEvent[] {
  const projected: MapEvent[] = [];
  const safeLimit = Math.max(0, Math.trunc(limit));

  for (const event of events) {
    if (projected.length >= safeLimit) break;
    const mapEvent = projectMapEvent(event);
    if (mapEvent) projected.push(mapEvent);
  }

  return projected;
}
