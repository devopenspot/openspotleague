import { parseYouTubeVideoUrl } from "@/lib/tv/urls";
import { makeSeededRng } from "@/lib/utils/seeded-random";
import type { SportDiscipline } from "@/types/sport-events";
import type { TvCard } from "@/types/tv";
import { ROUTES } from "@/lib/navigation/nav";

export type MarqueeKind = "spot" | "event" | "video";

export interface BaseMarqueeItem {
  kind: MarqueeKind;
  id: string;
  title: string;
  imageUrl: string | null;
  href: string;
  meta: string;
  disciplines: readonly SportDiscipline[];
  disciplineSlug: string | null;
}

export type MarqueeItem = BaseMarqueeItem;

/**
 * Minimum spot shape the wire reads. Both the full `Spot` and the slim
 * `SpotCard` (landing card query path) satisfy it structurally.
 */
export interface MarqueeSpotInput {
  id: string;
  name: string;
  city: string;
  image: string;
  sports: readonly SportDiscipline[];
}

/**
 * Minimum event shape the wire reads. Full `SportEventEnriched` satisfies
 * it structurally; server-side projection strips unused columns from the
 * RSC flight and `/api/events` shuffle responses.
 */
export interface MarqueeEventInput {
  id: string;
  name: string;
  image: string;
  slug: string;
  dateRangeLabel: string;
  sports: readonly SportDiscipline[];
}

export function toMarqueeEvent(event: MarqueeEventInput): MarqueeEventInput {
  return {
    id: event.id,
    name: event.name,
    image: event.image,
    slug: event.slug,
    dateRangeLabel: event.dateRangeLabel,
    sports: event.sports,
  };
}

/**
 * Minimum TV video shape the wire reads (`TvCard` minus `embedUrl`, which
 * `buildVideoItem` never consumes).
 */
export type MarqueeVideoInput = Omit<TvCard, "embedUrl">;

export function toMarqueeVideo(video: MarqueeVideoInput): MarqueeVideoInput {
  return {
    id: video.id,
    title: video.title,
    youtubeUrl: video.youtubeUrl,
    disciplineSlug: video.disciplineSlug,
    categories: video.categories,
    postDate: video.postDate,
  };
}

export function youtubeThumb(url: string): string | null {
  const parsed = parseYouTubeVideoUrl(url);
  if (!parsed) return null;
  try {
    const u = new URL(parsed.canonicalUrl);
    const id = u.searchParams.get("v");
    if (!id) return null;
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } catch {
    return null;
  }
}

function buildSpotItem(spot: MarqueeSpotInput): MarqueeItem {
  const cityLabel = spot.city;
  return {
    kind: "spot",
    id: spot.id,
    title: spot.name,
    imageUrl: spot.image,
    href: ROUTES.spot(spot.id),
    meta: `${cityLabel}`,
    disciplines: spot.sports,
    disciplineSlug: spot.sports[0]?.toLowerCase() ?? null,
  };
}

function buildEventItem(event: MarqueeEventInput): MarqueeItem {
  return {
    kind: "event",
    id: event.id,
    title: event.name,
    imageUrl: event.image,
    href: `/sport-events/${encodeURIComponent(event.slug)}`,
    meta: event.dateRangeLabel,
    disciplines: event.sports,
    disciplineSlug: event.sports[0]?.toLowerCase() ?? null,
  };
}

function buildVideoItem(video: MarqueeVideoInput): MarqueeItem {
  const thumb = youtubeThumb(video.youtubeUrl);
  const params = new URLSearchParams();
  params.set("play", video.id);
  if (thumb) params.set("thumb", thumb);
  params.set("title", video.title);
  const categoryLabel = video.categories[0];
  const meta = [categoryLabel].filter(Boolean).join(" · ");
  return {
    kind: "video",
    id: video.id,
    title: video.title,
    imageUrl: thumb,
    href: `${ROUTES.tv}?${params.toString()}`,
    meta,
    disciplines: [],
    disciplineSlug: video.disciplineSlug,
  };
}

function hasWireImage(spot: MarqueeSpotInput): boolean {
  return Boolean(spot.image?.trim());
}

const DEFAULT_VIDEO_SEED = "openspot-landing-wire";

function videoDateKey(postDate: string): string {
  const trimmed = postDate.trim();
  return trimmed.length >= 10 ? trimmed.slice(0, 10) : trimmed;
}

/**
 * Diversifies TV videos for the landing wire across categories and
 * post dates so visitors see a broad mix of categories and dates
 * rather than chronological clusters. Deterministic per `seed` to
 * keep SSR and client hydration identical while leaving the shared
 * `listTvCards` cache and TV section untouched.
 */
export function diversifyVideos(
  videos: readonly MarqueeVideoInput[],
  seed: string = DEFAULT_VIDEO_SEED,
): MarqueeVideoInput[] {
  if (videos.length <= 1) return [...videos];
  const rng = makeSeededRng(seed || DEFAULT_VIDEO_SEED);

  // 1. Shuffle across all dates first so chronological ordering is broken
  //    and multi-category videos aren't biased by postDate order.
  const pool = shuffled(videos, rng);

  // 2. Assign each unique video to its least-populated category bucket
  //    so every category gets surfaced without duplicating multi-category videos.
  const byCategory = new Map<string, MarqueeVideoInput[]>();
  const seenIds = new Set<string>();
  for (const video of pool) {
    if (seenIds.has(video.id)) continue;
    seenIds.add(video.id);

    const normalizedCategories = video.categories
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    let chosenCategory = "";
    if (normalizedCategories.length > 0) {
      chosenCategory = normalizedCategories[0]!;
      let minCount = byCategory.get(chosenCategory)?.length ?? 0;
      for (let i = 1; i < normalizedCategories.length; i += 1) {
        const candidate = normalizedCategories[i]!;
        const count = byCategory.get(candidate)?.length ?? 0;
        if (count < minCount) {
          chosenCategory = candidate;
          minCount = count;
        }
      }
    }

    const bucket = byCategory.get(chosenCategory);
    if (bucket) {
      bucket.push(video);
    } else {
      byCategory.set(chosenCategory, [video]);
    }
  }

  // 3. Within each category bucket, interleave across distinct postDates
  //    so consecutive rounds of the same category come from different dates.
  const categoryKeys = shuffled([...byCategory.keys()], rng);
  const categoryBuckets = categoryKeys.map((key) => {
    const items = byCategory.get(key) ?? [];
    if (items.length <= 1) return items;
    const byDate = new Map<string, MarqueeVideoInput[]>();
    for (const item of items) {
      const dKey = videoDateKey(item.postDate);
      const dBucket = byDate.get(dKey);
      if (dBucket) {
        dBucket.push(item);
      } else {
        byDate.set(dKey, [item]);
      }
    }
    const dateKeys = shuffled([...byDate.keys()], rng);
    const dateBuckets = dateKeys.map((dk) =>
      shuffled(byDate.get(dk) ?? [], rng),
    );
    return interleave(...dateBuckets);
  });

  return interleave(...categoryBuckets);
}

export function toMarqueeItems(args: {
  spots: readonly MarqueeSpotInput[];
  events: readonly MarqueeEventInput[];
  videos: readonly MarqueeVideoInput[];
  seed?: string;
}): MarqueeItem[] {
  const spotItems = args.spots.filter(hasWireImage).map(buildSpotItem);
  const eventItems = args.events.map(buildEventItem);
  const videoItems = diversifyVideos(args.videos, args.seed).map(
    buildVideoItem,
  );
  return interleave(spotItems, eventItems, videoItems);
}

/**
 * Round-robin interleave so the wire mixes spots/events/videos
 * instead of clustering one kind together. Keeps the "news bulletin"
 * feel: Spot · Event · Video · Spot …
 */
export function interleave<T>(...buckets: readonly (readonly T[])[]): T[] {
  const max = Math.max(0, ...buckets.map((b) => b.length));
  const out: T[] = [];
  for (let i = 0; i < max; i += 1) {
    for (const bucket of buckets) {
      const item = bucket[i];
      if (item !== undefined) out.push(item);
    }
  }
  return out;
}

export function filterByDiscipline(
  items: readonly MarqueeItem[],
  discipline: SportDiscipline | null,
): MarqueeItem[] {
  if (!discipline) return [...items];
  const needle = discipline.toLowerCase();
  return items.filter((item) => {
    if (item.disciplines.length > 0) {
      return item.disciplines.some((d) => d.toLowerCase() === needle);
    }
    if (item.disciplineSlug) {
      return item.disciplineSlug.toLowerCase() === needle;
    }
    return false;
  });
}

export function normalizeDisciplineSlug(
  slug: string | null | undefined,
): string | null {
  if (!slug) return null;
  const v = slug.trim().toLowerCase();
  return v.length > 0 ? v : null;
}

export function shuffled<T>(
  items: readonly T[],
  rng: () => number = Math.random,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
