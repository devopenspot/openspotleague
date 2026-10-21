import type { TvCard } from "@/types/tv";
import { youtubeThumbUrl } from "@/lib/tv/urls";

/** Static OG asset for TV shares (exact public/ filename, typo included). */
export const TV_OG_IMAGE_PATH = "/opengrapgh-tv.png";

export interface TvOgImageResult {
  url: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * Resolves the OpenGraph image metadata for a TV share.
 * Returns the video's YouTube thumbnail (480x360) when available,
 * falling back to the generic static TV banner (1200x630).
 */
export function resolveTvOgImage(
  video: TvCard | null,
  fallbackOgUrl: string,
): TvOgImageResult {
  if (!video) {
    return {
      url: fallbackOgUrl,
      width: 1200,
      height: 630,
      alt: "OpenSpot TV",
    };
  }

  const thumb = youtubeThumbUrl(video.youtubeUrl);
  if (!thumb) {
    return {
      url: fallbackOgUrl,
      width: 1200,
      height: 630,
      alt: video.title,
    };
  }

  return {
    url: thumb,
    width: 1200,
    height: 630,
    alt: video.title,
  };
}

/**
 * Canonical share path for a video — minimal (`/tv?play=<id>`) so every
 * share is one crawler-cacheable shape. Transient params (`thumb`,
 * `title`, `discipline`) are intentionally dropped.
 */
export function buildTvSharePath(id: string): string {
  return `/tv?play=${encodeURIComponent(id)}`;
}

/**
 * Absolute share URL for a video. `origin` is `window.location.origin`
 * on the client; omit it for a relative path (server metadata, tests).
 */
export function buildTvShareUrl(id: string, origin?: string): string {
  const path = buildTvSharePath(id);
  if (!origin) return path;
  return new URL(path, origin).toString();
}

/** "Jan 5, 2026" — mirrors the marquee card meta format. */
export function formatTvPostDate(postDate: string): string {
  try {
    const time = new Date(postDate).getTime();
    if (Number.isNaN(time)) return "";
    return new Date(time).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return "";
  }
}

/**
 * OG/social description for a video: "Music · skateboard · Jan 5, 2026 —
 * Watch on OpenSpot TV". Name (title) goes in the OG title field.
 */
export function buildTvShareDescription(video: TvCard): string {
  const categoriesLabel = video.categories
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(", ");
  const parts = [
    categoriesLabel,
    video.disciplineSlug,
    formatTvPostDate(video.postDate),
  ].filter(Boolean);
  const head = parts.join(" · ");
  return head ? `${head} — Watch on OpenSpot TV` : "Watch on OpenSpot TV";
}
