import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIME_FOR_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function extOf(path: string): string {
  const idx = path.lastIndexOf(".");
  return idx >= 0 ? path.slice(idx).toLowerCase() : "";
}

/**
 * True for absolute http(s) URLs safe to expose as `og:image`.
 * Relative/storage paths and `data:`/`javascript:` payloads return false.
 */
export function isHttpImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  const lower = value.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  )
    return false;
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const REMOTE_OG_FETCH_TIMEOUT_MS = 5000;
/** Cap remote OG fetches (~4MB) so a huge original can't OOM the route. */
const REMOTE_OG_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Fetch a remote image to a data URL for use inside `next/og` ImageResponse.
 * Returns null on timeout, non-2xx, non-image content-type, oversize body,
 * or any fetch error — callers must fall back to the default OG asset.
 */
export async function fetchRemoteImageAsDataUrl(
  url: string,
  timeoutMs = REMOTE_OG_FETCH_TIMEOUT_MS,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > REMOTE_OG_MAX_BYTES) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Load a public asset as a data URL for use inside `next/og` ImageResponse.
 * Falls back to null if the file is missing (e.g. in edge runtime or build without fs).
 */
export function loadPublicImageAsDataUrl(relativePublicPath: string): string | null {
  try {
    const clean = relativePublicPath.startsWith("/") ? relativePublicPath.slice(1) : relativePublicPath;
    // public/ is at process.cwd()/public
    const full = join(process.cwd(), "public", clean);
    if (!existsSync(full)) return null;
    const buf = readFileSync(full);
    const mime = MIME_FOR_EXT[extOf(full)] ?? "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
