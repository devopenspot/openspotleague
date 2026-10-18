import { MAX_UPLOAD_BYTES } from "@/lib/config/constants"
import { isR2ReadyStrict, shouldUseR2 } from "./config"
import { r2Adapter } from "./r2"
import { supabaseAdapter } from "./supabase"
import type { BucketKind } from "./adapter"
import { CACHE_CONTROL_IMMUTABLE } from "./adapter"
import { getStorageProvider } from "@/lib/config/env"
import { getVariantPaths } from "./variants"
import type { ImageVariant } from "./variants"
import { buildCacheTag } from "./cache-tag"
import { assertValidHttpUrl, isPrivateHostname } from "@/lib/net/ssrf"
import { UploadValidationError } from "./errors"

export const MAX_IMAGE_DIMENSION = 4000
export const MIN_IMAGE_DIMENSION = 32
export const MAX_STORED_DIMENSION = 2048

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"])
const ALLOWED_SHARP_FORMATS = new Set(["jpeg", "jpg", "png", "webp", "avif"])
const FETCH_TIMEOUT_MS = 10_000
const MAX_REDIRECTS = 3

export function getWriteAdapter(bucket: BucketKind) {
  const provider = getStorageProvider()
  if (provider === "supabase") return supabaseAdapter
  if (!isR2ReadyStrict(bucket)) {
    const domainVar = bucket === "spots" ? "R2_PUBLIC_DOMAIN_SPOTS" : "R2_PUBLIC_DOMAIN_EVENTS"
    throw new UploadValidationError(
      `R2 not configured for ${bucket}: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and ${domainVar} (or R2_PUBLIC_DOMAIN)`,
    )
  }
  return r2Adapter
}

export function getPublicStorageUrl(bucket: BucketKind, path: string): string {
  if (!shouldUseR2()) return supabaseAdapter.getPublicUrl(bucket, path)
  try {
    return r2Adapter.getPublicUrl(bucket, path)
  } catch {
    return supabaseAdapter.getPublicUrl(bucket, path)
  }
}

export async function fetchImageBuffer(urlString: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  let currentUrl = urlString
  assertValidHttpUrl(currentUrl)

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const parsed = new URL(currentUrl)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new UploadValidationError("Invalid image URL: only http and https are allowed")
    }
    if (isPrivateHostname(parsed.hostname)) {
      throw new UploadValidationError("Invalid image URL: private host not allowed")
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8" },
      })
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === "AbortError") {
        // @ts-expect-error - cause requires ES2022 lib, runtime supports it on Node 22
        throw new Error("Image URL not reachable: timeout", { cause: err })
      }
      // @ts-expect-error - cause requires ES2022 lib, runtime supports it on Node 22
      throw new Error(`Image URL not reachable: ${err instanceof Error ? err.message : String(err)}`, { cause: err })
    }
    clearTimeout(timeout)

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) throw new Error("Image URL not reachable: redirect without location")
      try {
        currentUrl = new URL(location, currentUrl).toString()
      } catch {
        throw new Error("Image URL not reachable: invalid redirect")
      }
      assertValidHttpUrl(currentUrl)
      continue
    }

    if (!res.ok) {
      throw new Error(`Image URL not reachable: HTTP ${res.status}`)
    }

    const rawContentType = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? null
    const contentLengthHeader = res.headers.get("content-length")
    if (contentLengthHeader) {
      const declared = Number(contentLengthHeader)
      if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
        throw new UploadValidationError("Images must be between 1 byte and 5 MB")
      }
      if (Number.isFinite(declared) && declared === 0) {
        throw new UploadValidationError("Images must be between 1 byte and 5 MB")
      }
    }

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new UploadValidationError("Images must be between 1 byte and 5 MB")
    }

    if (rawContentType && rawContentType !== "application/octet-stream" && !ALLOWED_IMAGE_TYPES.has(rawContentType)) {
      throw new UploadValidationError("Only PNG, JPG, WebP and AVIF images are supported")
    }

    return { buffer, contentType: rawContentType }
  }

  throw new Error("Image URL not reachable: too many redirects")
}

export interface UploadedImage {
  path: string
  variantPaths: Record<ImageVariant, string>
  url: string
}

export function assertValidImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new UploadValidationError("Only PNG, JPG, WebP and AVIF images are supported")
  }
  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("Images must be between 1 byte and 5 MB")
  }
}

async function getSharp(): Promise<unknown | null> {
  try {
    const mod = await import("sharp")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (mod as any).default ?? mod
  } catch {
    return null
  }
}

export async function processImageBuffer(
  inputBuffer: Buffer,
  bucket: BucketKind,
  basePath: string,
  fallbackContentType: string,
): Promise<UploadedImage> {
  if (inputBuffer.length === 0 || inputBuffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("Images must be between 1 byte and 5 MB")
  }

  const masterPath = `${basePath}.webp`
  const variantPaths = getVariantPaths(masterPath)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharpMod = (await getSharp()) as any | null

  const adapter = getWriteAdapter(bucket)
  const cacheTag = buildCacheTag(bucket, basePath)

  if (!sharpMod) {
    const fallbackMaster = basePath
    await adapter.put(bucket, fallbackMaster, inputBuffer, {
      cacheControl: CACHE_CONTROL_IMMUTABLE,
      contentType: fallbackContentType,
      cacheTag,
    })
    return {
      path: fallbackMaster,
      variantPaths: {
        master: fallbackMaster,
        thumb: fallbackMaster,
        card: fallbackMaster,
        detail: fallbackMaster,
      },
      url: getPublicStorageUrl(bucket, fallbackMaster),
    }
  }

  let metadata: { format?: string; width?: number; height?: number }
  try {
    metadata = await sharpMod(inputBuffer).metadata()
  } catch {
    throw new UploadValidationError("Only PNG, JPG, WebP and AVIF images are supported")
  }
  const format = metadata.format
  if (!format || !ALLOWED_SHARP_FORMATS.has(format)) {
    throw new UploadValidationError("Only PNG, JPG, WebP and AVIF images are supported")
  }
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (width === 0 || height === 0) {
    throw new UploadValidationError("Invalid image dimensions")
  }
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    throw new UploadValidationError(`Image dimensions too large (max ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION})`)
  }
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    throw new UploadValidationError(`Image too small (min ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION})`)
  }

  const toWebp = (w: number, quality: number) =>
    sharpMod(inputBuffer)
      .rotate()
      .resize({ width: w, height: w, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer() as Promise<Buffer>

  const [masterBuffer, thumbBuffer, cardBuffer, detailBuffer] = await Promise.all([
    sharpMod(inputBuffer)
      .rotate()
      .resize({ width: MAX_STORED_DIMENSION, height: MAX_STORED_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toBuffer() as Promise<Buffer>,
    toWebp(128, 70),
    toWebp(400, 75),
    toWebp(800, 78),
  ])

  const uploadBuffer = async (path: string, buffer: Buffer) => {
    await adapter.put(bucket, path, buffer, {
      cacheControl: CACHE_CONTROL_IMMUTABLE,
      contentType: "image/webp",
      cacheTag,
    })
  }

  try {
    await Promise.all([
      uploadBuffer(masterPath, masterBuffer),
      uploadBuffer(variantPaths.thumb, thumbBuffer),
      uploadBuffer(variantPaths.card, cardBuffer),
      uploadBuffer(variantPaths.detail, detailBuffer),
    ])
  } catch (err) {
    const allPaths = [masterPath, variantPaths.thumb, variantPaths.card, variantPaths.detail]
    await adapter.remove(bucket, allPaths).catch(() => undefined)
    throw err
  }

  return {
    path: masterPath,
    variantPaths,
    url: getPublicStorageUrl(bucket, masterPath),
  }
}
