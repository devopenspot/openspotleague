import type { BucketKind } from "./adapter"

export function buildCacheTag(bucket: BucketKind, basePath: string): string {
  const parts = basePath.split("/")
  const id = parts[1] ?? ""
  const prefix = bucket === "spots" ? "spot-images" : "event-images"
  const entity = bucket === "spots" ? "spot" : "event"
  return id ? `${prefix}, ${entity}-${id}` : prefix
}
