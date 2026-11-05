/**
 * Placeholder stored in `sport_events.image_url` when a contest has no
 * uploaded cover (the column is NOT NULL). UI never renders it as a photo:
 * `hasContestCover` gates the designed `ContestCover` fallback instead.
 */
export const DEFAULT_CONTEST_IMAGE = "/opengraph.png";

/** True when the contest has a real uploaded cover photo. */
export function hasContestCover(image: string | null | undefined): boolean {
  return Boolean(image) && image !== DEFAULT_CONTEST_IMAGE;
}

/** Client-side mirror of the storage upload rules (`assertValidImageFile`). */
export const CONTEST_COVER_ACCEPT = "image/png,image/jpeg,image/webp,image/avif";
export const CONTEST_COVER_MAX_BYTES = 5 * 1024 * 1024;

/** Validation message for a picked cover, or null when it is acceptable. */
export function contestCoverError(file: File): string | null {
  if (!CONTEST_COVER_ACCEPT.split(",").includes(file.type)) {
    return "Use a PNG, JPG, WebP or AVIF image.";
  }
  if (file.size <= 0 || file.size > CONTEST_COVER_MAX_BYTES) {
    return "Images must be 5 MB or smaller.";
  }
  return null;
}
