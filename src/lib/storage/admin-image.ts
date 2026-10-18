/* eslint-disable no-useless-assignment */
import "server-only"

import { isConnectionError, TimeoutError } from "@/lib/db/client"
import { UploadValidationError } from "./errors"
import type { BucketKind } from "./adapter"

type Uploader = (file: File, id: string) => Promise<{ path: string; url: string }>
type UrlUploader = (url: string, id: string) => Promise<{ path: string; url: string }>

export interface ImagePatchResult {
  patch: Record<string, unknown>
  uploadedPath: string | null
  previousPath: string | null
}

function isSignedUrl(value: string): boolean {
  return value.includes("/storage/v1/object/sign/")
}
function isPlaceholder(value: string): boolean {
  return value.includes("placeholder.local")
}
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * Single source of truth for spot/event admin image handling (file + URL + clear).
 * Lossy R2-only: file upload always goes to R2 (hard-fail with 400 if R2 not configured),
 * remote URL ingest also to R2, placeholder/signed echo stripped, empty clears imagePath.
 */
export async function resolveAdminImagePatch(opts: {
  bucket: BucketKind
  id: string
  imageFile: File | null
  imageValue: string | undefined
  isMultipart: boolean
  findExisting: (id: string) => Promise<{ imagePath: string | null } | null>
  uploadFile: Uploader
  uploadUrl: UrlUploader
}): Promise<ImagePatchResult> {
  const { bucket: _bucket, id, imageFile, imageValue, isMultipart, findExisting, uploadFile, uploadUrl } = opts
  let uploadedPath: string | null = null
  let previousPath: string | null = null
  let patch: Record<string, unknown> = {}

  if (imageFile) {
    const existing = await findExisting(id)
    if (!existing) throw new Error(`${_bucket === "spots" ? "Spot" : "Sport event"} not found: ${id}`)
    previousPath = existing.imagePath ?? null
    const uploaded = await uploadFile(imageFile, id)
    uploadedPath = uploaded.path
    patch = { image: uploaded.url, imagePath: uploaded.path }
    return { patch, uploadedPath, previousPath }
  }

  if (isMultipart && imageValue !== undefined) {
    const candidate = imageValue.trim()
    if (isSignedUrl(candidate) || isPlaceholder(candidate)) {
      // Echo of current private image (signed) or placeholder — don't overwrite
      return { patch: {}, uploadedPath: null, previousPath: null }
    }
    if (candidate && isHttpUrl(candidate) && !isPlaceholder(candidate)) {
      const existing = await findExisting(id)
      if (!existing) throw new Error(`${_bucket === "spots" ? "Spot" : "Sport event"} not found: ${id}`)
      previousPath = existing.imagePath ?? null
      const uploaded = await uploadUrl(candidate, id)
      uploadedPath = uploaded.path
      patch = { image: uploaded.url, imagePath: uploaded.path }
      return { patch, uploadedPath, previousPath }
    }
    // Empty string or non-http legacy value — clear private path so imageUrl not shadowed
    const existing = await findExisting(id)
    if (!existing) throw new Error(`${_bucket === "spots" ? "Spot" : "Sport event"} not found: ${id}`)
    if (existing.imagePath) {
      previousPath = existing.imagePath
      patch = { imagePath: null }
      return { patch, uploadedPath: null, previousPath }
    }
    return { patch: {}, uploadedPath: null, previousPath: null }
  }

  return { patch: {}, uploadedPath: null, previousPath: null }
}

export function mapUploadErrorToResponse(err: unknown): { error: string; status: number } | null {
  if (err instanceof UploadValidationError) return { error: err.message, status: 400 }
  if (err instanceof TimeoutError || isConnectionError(err)) return { error: "Storage is temporarily unavailable", status: 503 }
  return null
}
