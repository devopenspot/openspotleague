/**
 * Video contests take links, never uploads (Workers cannot transcode).
 * Only these hosts are accepted. Pure: no IO.
 */
import { LeagueDomainError } from "../definitions";

const ALLOWED_HOSTS: readonly string[] = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "vimeo.com",
  "drive.google.com",
];

export const VIDEO_HOST_LABELS = "YouTube, Instagram, Vimeo or Google Drive";

export const MAX_VIDEO_URL_LENGTH = 500;

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\.|^m\./, "");
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Returns the normalized https URL or throws INVALID_INPUT. */
export function normalizeVideoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_VIDEO_URL_LENGTH) {
    throw new LeagueDomainError("INVALID_INPUT", "Paste a video link");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new LeagueDomainError("INVALID_INPUT", "That doesn't look like a link");
  }
  if (url.protocol !== "https:" || !hostAllowed(url.hostname)) {
    throw new LeagueDomainError(
      "INVALID_INPUT",
      `Use an https link from ${VIDEO_HOST_LABELS}`,
    );
  }
  url.hash = "";
  return url.toString();
}

export function isAllowedVideoUrl(raw: string): boolean {
  try {
    normalizeVideoUrl(raw);
    return true;
  } catch {
    return false;
  }
}
