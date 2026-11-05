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
