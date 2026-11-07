/**
 * Pure helpers for `pnpm og:check` (scripts/og-check.ts): read a page's
 * share tags and judge the image a crawler would download. See
 * docs/og-cards.md → "Checking a deploy".
 */

/** Pages whose share image is a static card from design/og-cards/. */
export const OG_CHECK_PATHS = ["/", "/tv", "/league", "/games", "/support/data-curator"] as const;

/** Crawler user agent: some hosts and proxies answer bots differently. */
export const OG_CHECK_USER_AGENT = "facebookexternalhit/1.1 (+openspot og:check)";

/** WhatsApp silently drops images above roughly this size. */
export const MAX_OG_IMAGE_BYTES = 600_000;

export interface ShareTags {
  image: string | null;
  width: number | null;
  height: number | null;
  twitterImage: string | null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Reads one `<meta property|name="key" content="…">`, in either attribute order. */
function readMeta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /\b(?:property|name)\s*=\s*"([^"]*)"/i.exec(tag)?.[1];
    if (name !== key) continue;
    const content = /\bcontent\s*=\s*"([^"]*)"/i.exec(tag)?.[1];
    if (content !== undefined) return decodeEntities(content);
  }
  return null;
}

function readInt(html: string, key: string): number | null {
  const raw = readMeta(html, key);
  const n = raw === null ? NaN : Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseShareTags(html: string): ShareTags {
  return {
    image: readMeta(html, "og:image"),
    width: readInt(html, "og:image:width"),
    height: readInt(html, "og:image:height"),
    twitterImage: readMeta(html, "twitter:image"),
  };
}

/** Problems with a page's tags, judged against the page that served them. */
export function shareTagProblems(tags: ShareTags, pageUrl: string): string[] {
  const problems: string[] = [];
  if (!tags.image) return ["no og:image tag"];
  let image: URL;
  try {
    image = new URL(tags.image);
  } catch {
    return [`og:image is not an absolute URL: ${tags.image}`];
  }
  if (image.protocol !== "https:") problems.push(`og:image is not https: ${tags.image}`);
  const pageHost = new URL(pageUrl).host;
  if (image.host !== pageHost) {
    problems.push(`og:image host ${image.host} differs from the page host ${pageHost} (check APP_URL)`);
  }
  if (tags.width !== 1200 || tags.height !== 630) {
    problems.push(`declared size ${tags.width ?? "?"}x${tags.height ?? "?"}, expected 1200x630`);
  }
  if (tags.twitterImage && tags.twitterImage !== tags.image) {
    problems.push(`twitter:image ${tags.twitterImage} differs from og:image`);
  }
  return problems;
}

export interface ImageFetchResult {
  status: number;
  contentType: string | null;
  bytes: number;
}

/** Problems with the image a crawler downloaded. */
export function imageProblems(result: ImageFetchResult): string[] {
  const problems: string[] = [];
  if (result.status !== 200) problems.push(`image returned HTTP ${result.status}`);
  const type = result.contentType?.split(";")[0]?.trim() ?? null;
  if (type !== "image/png" && type !== "image/jpeg") {
    problems.push(`image content-type is ${type ?? "missing"}`);
  }
  if (result.bytes > MAX_OG_IMAGE_BYTES) {
    problems.push(`image is ${Math.round(result.bytes / 1000)} KB, over ${MAX_OG_IMAGE_BYTES / 1000} KB`);
  }
  return problems;
}

/** Turns a fetch failure into a readable cause (DNS, TLS, timeout…). */
export function describeFetchError(error: unknown, url: string): string {
  const cause = (error as { cause?: { code?: string } } | null)?.cause;
  const code = cause?.code ?? (error instanceof Error ? error.name : "");
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `host ${host} does not resolve (no DNS record): crawlers cannot download it`;
  }
  if (code === "AbortError" || code === "TimeoutError") return `request to ${host} timed out`;
  return `request to ${host} failed${code ? ` (${code})` : ""}`;
}
