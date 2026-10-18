import { createHash } from "node:crypto"

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalStringify(entry)).join(",")}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonicalStringify(val)}`).join(",")}}`
}

export function requestFingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex")
}

/** Legacy fingerprint using insertion-order JSON.stringify — kept for backwards compat check. */
export function legacyRequestFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function isFingerprintMatch(stored: string, candidate: unknown): boolean {
  const canonical = requestFingerprint(candidate)
  if (stored === canonical) return true
  // Accept previous-order hashes for deploy straddling (old rows created before canonical migration).
  return stored === legacyRequestFingerprint(candidate)
}
