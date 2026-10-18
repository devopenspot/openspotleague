export type BucketKind = "spots" | "events"

export interface StorageAdapter {
  getPublicUrl(bucket: BucketKind, path: string): string
  put(
    bucket: BucketKind,
    key: string,
    body: Buffer,
    opts: { contentType: string; cacheControl: string; cacheTag?: string },
  ): Promise<void>
  remove(bucket: BucketKind, keys: string[]): Promise<void>
  list?(bucket: BucketKind): Promise<string[]>
}

export const CACHE_CONTROL_IMMUTABLE = "public, max-age=31536000, immutable"
