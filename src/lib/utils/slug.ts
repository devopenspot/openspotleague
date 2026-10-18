/**
 * Diacritic-insensitive slug for URL params.
 * Single source of truth — consumed by `useMapFilter`, `back-to-map`,
 * `regions` service, and `sport-events/urls`.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
