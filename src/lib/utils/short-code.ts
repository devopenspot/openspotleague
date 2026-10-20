export const BASE62_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const DEFAULT_SHORT_CODE_LENGTH = 7;
export const CODE_PATTERN = /^[a-zA-Z0-9]{4,16}$/;
export const MAX_TARGET_URL_LENGTH = 2048;

export class ShortLinkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShortLinkValidationError";
  }
}

/**
 * Generates a cryptographically random Base62 string.
 *
 * Uses rejection sampling across 256-byte space (discarding bytes >= 248)
 * to eliminate modulo bias and achieve uniform entropy distribution.
 */
export function generateShortCode(length = DEFAULT_SHORT_CODE_LENGTH): string {
  if (length < 4 || length > 16) {
    throw new ShortLinkValidationError("Short code length must be between 4 and 16");
  }

  const alphabetLen = BASE62_ALPHABET.length; // 62
  const maxUnbiasedByte = 256 - (256 % alphabetLen); // 248

  let result = "";
  while (result.length < length) {
    const batchSize = Math.max((length - result.length) * 2, 8);
    const bytes = new Uint8Array(batchSize);
    crypto.getRandomValues(bytes);

    for (let i = 0; i < bytes.length && result.length < length; i++) {
      const byte = bytes[i];
      if (byte !== undefined && byte < maxUnbiasedByte) {
        result += BASE62_ALPHABET[byte % alphabetLen];
      }
    }
  }

  return result;
}

/**
 * Validates that a short code string matches the allowed alphanumeric pattern.
 */
export function isValidShortCode(code: unknown): code is string {
  return typeof code === "string" && CODE_PATTERN.test(code);
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

/**
 * Checks whether a hostname belongs to OpenSpot (internal origin).
 */
function isAllowedInternalHost(hostname: string, appHost?: string): boolean {
  const host = hostname.toLowerCase();
  if (appHost && host === appHost.toLowerCase()) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host === "openspotleague.com" || host.endsWith(".openspotleague.com")) return true;
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * Normalizes and validates a target URL for short-link creation.
 *
 * Enforces:
 * 1. String length bounds (1 to 2048 characters).
 * 2. Control character and protocol-relative (//) rejection.
 * 3. Dangerous protocol rejection (only http: and https: allowed).
 * 4. Origin extraction: Converts allowed absolute URLs to canonical relative paths.
 * 5. External domain rejection (anti-phishing / open-redirect guard).
 * 6. Recursion prevention (rejects /s and /s/* targets).
 * 7. Internal route block (rejects /api/*, /_next/*, /admin/*).
 * 8. Trailing slash removal on paths.
 * 9. Canonical alphabetical query parameter sorting.
 */
export function normalizeTargetUrl(input: unknown, appOrigin?: string): string {
  if (typeof input !== "string") {
    throw new ShortLinkValidationError("Target URL must be a string");
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new ShortLinkValidationError("Target URL cannot be empty");
  }
  if (trimmed.length > MAX_TARGET_URL_LENGTH) {
    throw new ShortLinkValidationError(`Target URL exceeds maximum length of ${MAX_TARGET_URL_LENGTH} characters`);
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    throw new ShortLinkValidationError("Target URL contains forbidden control characters");
  }
  if (trimmed.startsWith("//")) {
    throw new ShortLinkValidationError("Protocol-relative URLs are not permitted");
  }

  // Parse candidate URL
  let parsed: URL;
  const isAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);

  if (isAbsolute) {
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new ShortLinkValidationError("Invalid URL format");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ShortLinkValidationError(`Forbidden protocol: ${parsed.protocol}`);
    }

    let configuredAppHost: string | undefined;
    if (appOrigin) {
      try {
        configuredAppHost = new URL(appOrigin).hostname;
      } catch {
        // Ignore malformed appOrigin
      }
    }

    if (!isAllowedInternalHost(parsed.hostname, configuredAppHost)) {
      throw new ShortLinkValidationError("External domains are not permitted as short link targets");
    }
  } else {
    if (!trimmed.startsWith("/")) {
      throw new ShortLinkValidationError("Relative target URL must start with '/'");
    }
    try {
      parsed = new URL(trimmed, "https://openspot.internal");
    } catch {
      throw new ShortLinkValidationError("Invalid relative URL path");
    }
  }

  // Path normalization
  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // Anti-recursion guard: cannot shorten /s or /s/*
  if (pathname === "/s" || pathname.startsWith("/s/")) {
    throw new ShortLinkValidationError("Short links cannot target another short link (/s/*)");
  }

  // Internal infrastructure block
  if (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/admin/") ||
    pathname === "/admin"
  ) {
    throw new ShortLinkValidationError("Internal infrastructure and admin routes cannot be short link targets");
  }

  // Canonical query parameter sorting
  let search = "";
  if (parsed.search && parsed.search !== "?") {
    const params = new URLSearchParams(parsed.search);
    params.sort();
    const sorted = params.toString();
    if (sorted) {
      search = `?${sorted}`;
    }
  }

  const hash = parsed.hash || "";

  return `${pathname}${search}${hash}`;
}
