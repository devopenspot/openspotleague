import { isShortLinksEnabled } from "@/lib/config/feature-flags";

const pendingShortUrls = new Map<string, Promise<string>>();
const resolvedShortUrls = new Map<string, string>();

/**
 * Resolves a URL to an absolute URL based on window.location.origin on client,
 * or returns it as-is on server.
 */
export function resolveCanonicalShareUrl(url: string): string {
  if (typeof window === "undefined") {
    return url;
  }
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

/**
 * Asynchronously shortens a shareable URL, with multi-layer deduplication and
 * instant fallback to the canonical long URL if offline, disabled, or failed.
 */
export async function getOrFetchShortUrl(
  url: string,
  title?: string,
): Promise<string> {
  const canonicalUrl = resolveCanonicalShareUrl(url);

  // If already a short link, return immediately
  if (url.includes("/s/") || canonicalUrl.includes("/s/")) {
    return canonicalUrl;
  }

  // Fast-path: feature disabled or client offline -> immediate canonical fallback
  if (
    !isShortLinksEnabled() ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return canonicalUrl;
  }

  const cacheKey = url.trim();

  // In-memory resolved cache hit
  const existing = resolvedShortUrls.get(cacheKey);
  if (existing) {
    return existing;
  }

  // In-flight promise deduplication
  const pending = pendingShortUrls.get(cacheKey);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const response = await fetch("/api/short-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: cacheKey, title }),
      });

      if (!response.ok) {
        return canonicalUrl;
      }

      const data = await response.json();
      if (typeof data?.shortUrl === "string") {
        resolvedShortUrls.set(cacheKey, data.shortUrl);
        return data.shortUrl;
      }

      return canonicalUrl;
    } catch {
      // Offline or network error: never fail the user, fall back to canonical URL
      return canonicalUrl;
    } finally {
      pendingShortUrls.delete(cacheKey);
    }
  })();

  pendingShortUrls.set(cacheKey, promise);
  return promise;
}

/**
 * Resets memory caches (used for isolated unit testing).
 */
export function clearShortUrlMemoryCache(): void {
  pendingShortUrls.clear();
  resolvedShortUrls.clear();
}
