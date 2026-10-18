import "server-only"

import { cache } from "react"
import { cacheLife, cacheTag } from "next/cache"
import type { Spot } from "@/lib/types"
import type { SportEvent } from "@/types/sport-events"
import { IMAGE_CACHE_LIFE } from "@/lib/cache/lifetimes"
import { getVariantPath, getVariantPaths } from "./variants"
import type { ImageVariant } from "./variants"
import type { BucketKind } from "./adapter"
import {
  assertValidImageFile,
  fetchImageBuffer,
  getPublicStorageUrl,
  getWriteAdapter,
  processImageBuffer,
  type UploadedImage,
} from "./process"

export { UploadValidationError } from "./errors"
export { getVariantPath } from "./variants"
export type { ImageVariant } from "./variants"
export { processImageBuffer, getPublicStorageUrl } from "./process"

function getPublicImageUrlsMap(paths: readonly string[], bucket: BucketKind): Map<string, string> {
  const out = new Map<string, string>()
  for (const p of paths) out.set(p, getPublicStorageUrl(bucket, p))
  return out
}

function getPublicVariantImageUrlsMap(
  masterPaths: readonly string[],
  bucket: BucketKind,
  variant: ImageVariant,
): Map<string, string> {
  if (masterPaths.length === 0) return new Map()
  const variantToMasters = new Map<string, string[]>()
  const masterToVariant = new Map<string, string>()
  for (const master of masterPaths) {
    const variantPath = getVariantPath(master, variant)
    masterToVariant.set(master, variantPath)
    const list = variantToMasters.get(variantPath)
    if (list) list.push(master)
    else variantToMasters.set(variantPath, [master])
  }
  const uniqueVariantPaths = Array.from(variantToMasters.keys())
  const variantMap = getPublicImageUrlsMap(uniqueVariantPaths, bucket)
  const out = new Map<string, string>()
  for (const [variantPath, masters] of variantToMasters) {
    const url = variantMap.get(variantPath)
    if (url) for (const master of masters) out.set(master, url)
  }
  const missingMasters = masterPaths.filter((m) => {
    if (out.has(m)) return false
    return masterToVariant.get(m) !== m
  })
  if (missingMasters.length > 0) {
    const fallback = getPublicImageUrlsMap(missingMasters, bucket)
    for (const [k, v] of fallback) out.set(k, v)
  }
  return out
}

const SPOT_IMAGES_CACHE_TAG = "spot-images"
const EVENT_IMAGES_CACHE_TAG = "event-images"

async function processAndUploadImage(file: File, bucket: BucketKind, basePath: string): Promise<UploadedImage> {
  assertValidImageFile(file)
  const arrayBuffer = await file.arrayBuffer()
  const inputBuffer = Buffer.from(arrayBuffer)
  return processImageBuffer(inputBuffer, bucket, basePath, file.type)
}

async function processAndUploadImageFromUrl(url: string, bucket: BucketKind, basePath: string): Promise<UploadedImage> {
  const { buffer, contentType } = await fetchImageBuffer(url)
  const fallback = contentType ?? "image/jpeg"
  return processImageBuffer(buffer, bucket, basePath, fallback)
}

async function removeImageWithVariants(bucket: BucketKind, masterPath: string): Promise<void> {
  const variantPaths = getVariantPaths(masterPath)
  const allPaths = [variantPaths.master, variantPaths.thumb, variantPaths.card, variantPaths.detail]
  const unique = Array.from(new Set(allPaths))
  const adapter = getWriteAdapter(bucket)
  await adapter.remove(bucket, unique)
}

export async function uploadSpotImage(file: File, spotId: string): Promise<UploadedImage> {
  const basePath = `spots/${spotId}/${crypto.randomUUID()}`
  return processAndUploadImage(file, "spots", basePath)
}

export async function uploadSpotImageFromUrl(url: string, spotId: string): Promise<UploadedImage> {
  const basePath = `spots/${spotId}/${crypto.randomUUID()}`
  return processAndUploadImageFromUrl(url, "spots", basePath)
}

export async function uploadEventImage(file: File, eventId: string): Promise<UploadedImage> {
  const basePath = `events/${eventId}/${crypto.randomUUID()}`
  return processAndUploadImage(file, "events", basePath)
}

export async function uploadEventImageFromUrl(url: string, eventId: string): Promise<UploadedImage> {
  const basePath = `events/${eventId}/${crypto.randomUUID()}`
  return processAndUploadImageFromUrl(url, "events", basePath)
}

export function deleteSpotImage(path: string): Promise<void> {
  return removeImageWithVariants("spots", path)
}

export function deleteEventImage(path: string): Promise<void> {
  return removeImageWithVariants("events", path)
}

export async function getSpotImageUrl(path: string): Promise<string> {
  return getPublicStorageUrl("spots", path)
}

export const getSpotImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicImageUrlsMap(paths, "spots")))

export const getEventImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicImageUrlsMap(paths, "events")))

export async function getSpotImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  "use cache"
  cacheTag(SPOT_IMAGES_CACHE_TAG)
  cacheLife(IMAGE_CACHE_LIFE)
  const sorted = [...new Set(paths)].sort()
  return getPublicImageUrlsMap(sorted, "spots")
}

export async function getEventImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  "use cache"
  cacheTag(EVENT_IMAGES_CACHE_TAG)
  cacheLife(IMAGE_CACHE_LIFE)
  const sorted = [...new Set(paths)].sort()
  return getPublicImageUrlsMap(sorted, "events")
}

async function getCachedVariantImageUrls(
  masterPaths: readonly string[],
  bucket: BucketKind,
  variant: ImageVariant,
  tag: string,
): Promise<Map<string, string>> {
  "use cache"
  cacheTag(tag)
  cacheLife(IMAGE_CACHE_LIFE)
  const sorted = [...new Set(masterPaths)].sort()
  return getPublicVariantImageUrlsMap(sorted, bucket, variant)
}

export async function getSpotCardImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  return getCachedVariantImageUrls(paths, "spots", "card", SPOT_IMAGES_CACHE_TAG)
}
export async function getSpotDetailImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  return getCachedVariantImageUrls(paths, "spots", "detail", SPOT_IMAGES_CACHE_TAG)
}
export async function getSpotThumbImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  return getCachedVariantImageUrls(paths, "spots", "thumb", SPOT_IMAGES_CACHE_TAG)
}
export async function getEventCardImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  return getCachedVariantImageUrls(paths, "events", "card", EVENT_IMAGES_CACHE_TAG)
}
export async function getEventDetailImageUrlsCached(paths: readonly string[]): Promise<Map<string, string>> {
  return getCachedVariantImageUrls(paths, "events", "detail", EVENT_IMAGES_CACHE_TAG)
}

async function getVariantImageUrls(
  masterPaths: readonly string[],
  bucket: BucketKind,
  variant: ImageVariant,
): Promise<Map<string, string>> {
  return getPublicVariantImageUrlsMap(masterPaths, bucket, variant)
}

export const getSpotCardImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicVariantImageUrlsMap(paths, "spots", "card")))
export const getSpotDetailImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicVariantImageUrlsMap(paths, "spots", "detail")))
export const getSpotThumbImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicVariantImageUrlsMap(paths, "spots", "thumb")))

export const getEventCardImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicVariantImageUrlsMap(paths, "events", "card")))
export const getEventDetailImageUrls = cache((paths: readonly string[]): Promise<Map<string, string>> => Promise.resolve(getPublicVariantImageUrlsMap(paths, "events", "detail")))

// Legacy aliases kept for shim compatibility; prefer getPublic* above.
export const getSignedImageUrls = (paths: readonly string[], bucket: BucketKind) => getPublicImageUrlsMap([...paths], bucket)
export const getSignedVariantImageUrls = getVariantImageUrls

export interface SpotWithImagePath<T extends { image: string } = Spot> {
  spot: T
  imagePath: string | null
}

export async function withImageUrls<T extends { image: string } = Spot>(entries: readonly SpotWithImagePath<T>[]): Promise<T[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getSpotImageUrlsCached(paths)
  return entries.map(({ spot, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...spot, image: urlMap.get(imagePath)! }
    }
    return spot
  })
}

export async function withCardImageUrls<T extends { image: string } = Spot>(entries: readonly SpotWithImagePath<T>[]): Promise<T[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getSpotCardImageUrlsCached(paths)
  return entries.map(({ spot, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...spot, image: urlMap.get(imagePath)! }
    }
    return spot
  })
}

export async function withDetailImageUrls<T extends { image: string } = Spot>(entries: readonly SpotWithImagePath<T>[]): Promise<T[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getSpotDetailImageUrlsCached(paths)
  return entries.map(({ spot, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...spot, image: urlMap.get(imagePath)! }
    }
    return spot
  })
}

export async function withThumbImageUrls<T extends { image: string } = Spot>(entries: readonly SpotWithImagePath<T>[]): Promise<T[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getSpotThumbImageUrlsCached(paths)
  return entries.map(({ spot, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...spot, image: urlMap.get(imagePath)! }
    }
    return spot
  })
}

export interface EventWithImagePath {
  event: SportEvent
  imagePath: string | null
}

export async function withEventImageUrls(entries: readonly EventWithImagePath[]): Promise<SportEvent[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getEventImageUrlsCached(paths)
  return entries.map(({ event, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...event, image: urlMap.get(imagePath)! }
    }
    return event
  })
}

export async function withEventCardImageUrls(entries: readonly EventWithImagePath[]): Promise<SportEvent[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getEventCardImageUrlsCached(paths)
  return entries.map(({ event, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...event, image: urlMap.get(imagePath)! }
    }
    return event
  })
}

export async function withEventDetailImageUrls(entries: readonly EventWithImagePath[]): Promise<SportEvent[]> {
  const paths = entries.map((entry) => entry.imagePath).filter((path): path is string => path !== null)
  const urlMap = await getEventDetailImageUrlsCached(paths)
  return entries.map(({ event, imagePath }) => {
    if (imagePath && urlMap.has(imagePath)) {
      return { ...event, image: urlMap.get(imagePath)! }
    }
    return event
  })
}

// Adapters are available via direct import "@/lib/storage/r2" / "@/lib/storage/supabase" for scripts
