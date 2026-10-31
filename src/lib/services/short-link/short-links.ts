import { cacheLife, cacheTag } from "next/cache";
import { queueTagRevalidate, runWithDeferredCacheInvalidation } from "@/lib/cache/deferred";
import { SHORT_LINK_CACHE_LIFE } from "@/lib/cache/lifetimes";
import { getShortLinkRepositoryAsync } from "@/lib/repositories";
import type { ShortLink } from "@/db/schema";
import { generateShortCode, isValidShortCode, normalizeTargetUrl } from "@/lib/utils/short-code";

export interface CreateShortLinkParams {
  targetUrl: string;
  title?: string | null;
}

/**
 * Underlying database fetch for short link resolution.
 */
export async function runResolveShortLink(code: string): Promise<ShortLink | null> {
  if (!isValidShortCode(code)) {
    return null;
  }
  const repo = await getShortLinkRepositoryAsync();
  return repo.findByCode(code);
}

/**
 * Cached short link resolver.
 *
 * Decorated with Next.js 16 "use cache", tagged by code, and cached for 24h.
 */
export async function resolveShortLink(code: string): Promise<ShortLink | null> {
  "use cache";
  cacheTag(`short-link:${code}`);
  cacheLife(SHORT_LINK_CACHE_LIFE);
  return runResolveShortLink(code);
}

/**
 * Creates or deduplicates a short link for the given target destination.
 *
 * 1. Normalizes the target URL and enforces open redirect / anti-recursion guards.
 * 2. Checks if a short link already exists for the canonical destination (O(1) deduplication).
 * 3. Inserts (each `create` is its own transaction) with collision retry (up to 3 attempts).
 * 4. Catches target_url concurrency races gracefully and returns the winner's record.
 */
export async function createShortLink(
  input: CreateShortLinkParams,
  appOrigin?: string,
): Promise<ShortLink> {
  const normalizedUrl = normalizeTargetUrl(input.targetUrl, appOrigin);
  const repo = await getShortLinkRepositoryAsync();

  // Deduplicate first. This read is not transactional; concurrent creates of
  // the same target are resolved by the target_url unique index below.
  const existing = await repo.findByTargetUrl(normalizedUrl);
  if (existing) {
    return existing;
  }

  // Each repository call takes its own DB gate slot (and `create` its own
  // transaction), so this body must not be wrapped in `withDbWrite`. The
  // deferred scope still flushes the cache tag only after the insert commits.
  return runWithDeferredCacheInvalidation(async () => {
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const code = generateShortCode();

      try {
        const created = await repo.create({
          code,
          targetUrl: normalizedUrl,
          title: input.title ?? null,
        });

        queueTagRevalidate(`short-link:${code}`, SHORT_LINK_CACHE_LIFE);
        return created;
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const isUniqueViolation =
          errMessage.includes("unique") ||
          errMessage.includes("23505") ||
          (typeof err === "object" &&
            err !== null &&
            "code" in err &&
            (err as { code: string }).code === "23505");

        if (isUniqueViolation) {
          // If another request inserted the same target_url concurrently, return it
          const raceWinner = await repo.findByTargetUrl(normalizedUrl);
          if (raceWinner) {
            return raceWinner;
          }
          // If collision was on the generated code, retry with a new code
          continue;
        }

        throw err;
      }
    }

    throw new Error("Failed to generate unique short code after 3 attempts");
  });
}
