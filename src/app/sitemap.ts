import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { env } from '@/lib/config/env';
import { listSpots } from '@/lib/services/spot/spots';
import { EMPTY_SPOT_LIST, withSafeDefault } from '@/lib/utils/safe-fetch';
import type { Spot } from '@/lib/types';

const BASE_URL = env.APP_URL;
// Cursor pages of `SPOT_LIST_HARD_CAP` (500) — 40 pages cover 20k
// spots (far above the current DB), so the sitemap covers the full
// public directory instead of the first-500 slice it shipped before.
const SITEMAP_MAX_PAGES = 40;

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

  // Page the cached list service by cursor so every public spot is
  // covered, not just the first `SPOT_LIST_HARD_CAP` rows. The DB
  // call stays wrapped so a DB outage degrades to the 6 static
  // entries above instead of 500-ing the sitemap.
  const spots: Spot[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < SITEMAP_MAX_PAGES; page++) {
    const result = await withSafeDefault(
      () => listSpots(cursor ? { cursor } : undefined),
      EMPTY_SPOT_LIST,
      'listSpots',
    );
    if (result.items.length === 0) break;
    spots.push(...result.items);
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }
  const spotEntries: MetadataRoute.Sitemap = spots.map(spot => ({
    url: `${BASE_URL}/spots/${spot.id}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticEntries, ...spotEntries];
}
