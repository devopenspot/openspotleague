import { UploadValidationError } from "@/lib/storage/errors"

export function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (lower === "localhost" || lower.endsWith(".localhost")) return true
  if (lower === "0.0.0.0" || lower === "::" || lower === "::1") return true
  if (/^127\./.test(lower)) return true
  if (/^10\./.test(lower)) return true
  if (/^192\.168\./.test(lower)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true
  if (/^0\./.test(lower)) return true
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true
  if (lower.startsWith("fe80:")) return true
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7)
    return isPrivateHostname(v4)
  }
  return false
}

export function assertValidHttpUrl(urlString: string): URL {
  let parsed: URL
  try {
    parsed = new URL(urlString)
  } catch {
    throw new UploadValidationError("Invalid image URL")
  }
  const proto = parsed.protocol.toLowerCase()
  if (proto !== "http:" && proto !== "https:") {
    throw new UploadValidationError("Invalid image URL: only http and https are allowed")
  }
  const lower = urlString.toLowerCase()
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    throw new UploadValidationError("Invalid image URL")
  }
  if (isPrivateHostname(parsed.hostname)) {
    throw new UploadValidationError("Invalid image URL: private host not allowed")
  }
  return parsed
}
