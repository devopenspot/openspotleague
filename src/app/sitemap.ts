import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { env } from '@/lib/config/env';
import { listSpotShuffleIds } from '@/lib/services/spot/spots';
import { withSafeDefault } from '@/lib/utils/safe-fetch';

const BASE_URL = env.APP_URL;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/explore`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/map`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/saved`, lastModified: now, changeFrequency: 'never', priority: 0.3 },
    { url: `${BASE_URL}/sport-events`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  // The /admin/* dashboard is intentionally absent: it's auth-gated by
  // `requireAdminOrRedirect`, the layout sets `robots: { index: false,
  // follow: false }`, and `src/app/robots.ts` disallows `/admin/` for all
  // user-agents. We keep the static list hand-curated to public pages.

  // IDs only, from the shared (`"use cache: remote"`) public-ID list. The
  // previous walk paged `listSpots` (≈57 pages × 500 FULL spot rows) on
  // every uncached sitemap request — tens of MB of Shared Pooler Egress
  // per crawler fetch just to emit `/spots/{id}` URLs. The DB call stays
  // wrapped so an outage degrades to the static entries above.
  const spotIds = await withSafeDefault(
    () => listSpotShuffleIds({}),
    [] as readonly string[],
    'listSpotShuffleIds',
  );
  const spotEntries: MetadataRoute.Sitemap = spotIds.map(id => ({
    url: `${BASE_URL}/spots/${id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...spotEntries];
}
