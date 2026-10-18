import { ROUTES } from "@/lib/navigation/nav";
import { slugify } from "@/lib/utils/slug";

export interface BuildEventMapUrlInput {
  location: {
    country: string;
    region?: string;
  };
}

/**
 * Build the deep-link URL an event card sends the rider to. The URL
 * is the single source of truth for the map's layer + filter state —
 * `useMapLayer` and `useMapFilter` are the only readers, and changes
 * to the contract happen here. The `?country=` (and optional
 * `?region=`) param reuses the existing `useMapFilter` logic, which
 * is the "spots in the same country / region of the event" filter.
 *
 * The layer param explicitly keeps both spots and events visible, so this
 * deep link remains stable if the map's default layer set changes later.
 *
 * The function never reads from the URL, never calls `Date.now()`,
 * and never imports server-only modules — it is safe to call from
 * both server and client components.
 */
export function buildEventMapUrl(input: BuildEventMapUrlInput): string {
  const countrySlug = slugify(input.location.country);
  const params = new URLSearchParams();
  params.set("layer", "spots,events");
  params.set("country", countrySlug);
  if (input.location.region) {
    params.set("region", slugify(input.location.region));
  }
  return `${ROUTES.map}?${params.toString()}`;
}
