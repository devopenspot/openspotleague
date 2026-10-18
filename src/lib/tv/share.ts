import type { TvCard } from "@/types/tv";

/** Static OG asset for TV shares (exact public/ filename, typo included). */
export const TV_OG_IMAGE_PATH = "/opengrapgh-tv.png";

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
  const parts = [categoriesLabel, video.disciplineSlug, formatTvPostDate(video.postDate)].filter(
    Boolean,
  );
  const head = parts.join(" · ");
  return head ? `${head} — Watch on OpenSpot TV` : "Watch on OpenSpot TV";
}
