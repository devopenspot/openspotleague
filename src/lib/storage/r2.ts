import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import {
  getR2AccessKeyId,
  getR2SecretAccessKey,
} from "@/lib/config/env"
import type { StorageAdapter } from "./adapter"
import { resolveR2Bucket, resolveR2Domain, getR2Endpoint } from "./config"

let client: S3Client | null = null

function getR2Client(): S3Client {
  const endpoint = getR2Endpoint()
  if (!endpoint) throw new Error("R2 endpoint not configured (R2_ACCOUNT_ID)")
  const accessKeyId = getR2AccessKeyId()
  const secretAccessKey = getR2SecretAccessKey()
  if (!accessKeyId || !secretAccessKey) throw new Error("R2 credentials not configured")
  if (client) return client
  client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  })
  return client
}

export function resetR2ClientForTests(): void {
  client = null
}

export const r2Adapter: StorageAdapter = {
  getPublicUrl(bucket, path) {
    const domain = resolveR2Domain(bucket)
    if (!domain) throw new Error(`R2 public domain not configured for ${bucket}`)
    const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
    return `https://${host}/${path}`
  },

  async put(bucket, key, body, opts) {
    const Bucket = resolveR2Bucket(bucket)
    const s3 = getR2Client()
    const command = new PutObjectCommand({
      Bucket,
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl,
      // R2 extension: CacheTag header via S3 param `CacheTag` (Cloudflare docs)
      // Fallback: if unsupported, Cache-Tag via Metadata is ignored but harmless.
      ...(opts.cacheTag ? { CacheTag: opts.cacheTag } : {}),
    })
    try {
      await s3.send(command)
    } catch (err) {
      // @ts-expect-error - cause requires ES2022 lib, runtime supports it on Node 22
      throw new Error(`R2 upload failed (${bucket}/${key}): ${err instanceof Error ? err.message : String(err)}`, {
        cause: err,
      })
    }
  },

  async remove(bucket, keys) {
    if (keys.length === 0) return
    const Bucket = resolveR2Bucket(bucket)
    const s3 = getR2Client()
    // DeleteObjects max 1000 per call; chunk 100 for safety
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100)
      const command = new DeleteObjectsCommand({
        Bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
      try {
        await s3.send(command)
      } catch (err) {
        // @ts-expect-error - cause requires ES2022 lib, runtime supports it on Node 22
        throw new Error(`R2 delete failed (${bucket}): ${err instanceof Error ? err.message : String(err)}`, {
          cause: err,
        })
      }
    }
  },

  async list(bucket) {
    const Bucket = resolveR2Bucket(bucket)
    const s3 = getR2Client()
    const out: string[] = []
    let token: string | undefined
    do {
      const command = new ListObjectsV2Command({ Bucket, ContinuationToken: token, MaxKeys: 1000 })
      const res = await s3.send(command)
      for (const o of res.Contents ?? []) if (o.Key) out.push(o.Key)
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)
    return out
  },
}
