import {
  getR2AccountId,
  getR2BucketEvents,
  getR2BucketSpots,
  getR2PublicDomainEvents,
  getR2PublicDomainSpots,
  getStorageProvider,
  isR2Ready,
} from "@/lib/config/env"
import type { BucketKind } from "./adapter"

export function resolveR2Bucket(kind: BucketKind): string {
  return kind === "spots" ? getR2BucketSpots() : getR2BucketEvents()
}

export function resolveR2Domain(kind: BucketKind): string | null {
  return kind === "spots" ? getR2PublicDomainSpots() : getR2PublicDomainEvents()
}

export function getR2Endpoint(): string | null {
  const account = getR2AccountId()
  if (!account) return null
  return `https://${account}.r2.cloudflarestorage.com`
}

export function shouldUseR2(): boolean {
  const p = getStorageProvider()
  if (p === "supabase") return false
  const hasAccount = Boolean(getR2AccountId())
  const hasDomain = Boolean(getR2PublicDomainSpots() || getR2PublicDomainEvents())
  if (!hasAccount || !hasDomain) return false
  return p === "r2"
}

/** @deprecated Use isR2Ready from @/lib/config/env */
export function isDualRead(): boolean {
  return false
}

export function isR2ConfiguredFor(kind: BucketKind): boolean {
  return isR2Ready(kind)
}

/** Strict readiness: account + key + secret + per-bucket domain. Single source of truth. */
export function isR2ReadyStrict(kind: BucketKind): boolean {
  return isR2Ready(kind)
}
