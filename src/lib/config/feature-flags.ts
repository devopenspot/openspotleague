/**
 * Centralized feature flag evaluation.
 *
 * Keeps client and server checks consistent and avoids duplicate env parsing.
 */

export function isShortLinksEnabled(): boolean {
  const val = process.env.NEXT_PUBLIC_FEATURE_SHORT_LINKS?.trim().toLowerCase();
  return val === "on" || val === "true" || val === "1";
}
