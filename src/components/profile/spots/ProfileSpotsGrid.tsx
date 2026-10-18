"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Heart, CheckCircle, MapPinned } from "lucide-react"
import { AppImage } from "@/components/ui/AppImage"
import type { Spot } from "@/lib/types"

type Kind = "saved" | "verified" | "visited"

function SpotCard({ spot }: { spot: Spot }) {
  return (
    <Link
      href={`/spots/${spot.id}`}
      className="group overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-lowest transition-colors hover:border-outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-container">
        <AppImage src={spot.image} alt={spot.name} fill sizes="(min-width: 1024px) 28vw, (min-width: 640px) 42vw, 100vw" className="object-cover transition-transform group-hover:scale-[1.02]" unoptimized referrerPolicy="no-referrer" />
      </div>
      <div className="p-2.5">
        <p className="truncate font-display text-[13px] font-bold uppercase leading-tight">{spot.name}</p>
        <p className="truncate font-display text-[10px] uppercase tracking-widest text-secondary">{spot.city} • {spot.country}</p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {spot.types.slice(0, 3).map((t) => (
            <span key={t.slug} className="rounded-full bg-surface-container-high px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest text-secondary">{t.name}</span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function SpotCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-lowest animate-pulse">
      <div className="aspect-[16/10] w-full bg-surface-container-high" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 w-24 rounded bg-surface-container-high" />
        <div className="h-3 w-32 rounded bg-surface-container-high" />
        <div className="flex gap-1">
          <div className="h-4 w-12 rounded-full bg-surface-container-high" />
          <div className="h-4 w-14 rounded-full bg-surface-container-high" />
        </div>
      </div>
    </div>
  )
}

export function ProfileSpotsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <SpotCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProfileSpotsGrid() {
  const [kind, setKind] = useState<Kind>("saved")
  const [items, setItems] = useState<readonly Spot[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Bumped on every load; responses from a superseded load are discarded so a
  // quick kind switch can never append stale results into the newer list.
  const loadGenerationRef = useRef(0)

  const load = async (reset = false) => {
    const generation = ++loadGenerationRef.current
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ kind, limit: "12" })
      if (!reset && cursor) params.set("cursor", cursor)
      const res = await fetch(`/api/profile/spots?${params.toString()}`)
      if (!res.ok) throw new Error("failed")
      const data = (await res.json()) as { items: readonly Spot[]; nextCursor: string | null }
      if (generation !== loadGenerationRef.current) return
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]))
      setCursor(data.nextCursor)
    } catch {
      if (generation !== loadGenerationRef.current) return
      setError(true)
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems([])
    setCursor(null)
    void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="space-y-3" aria-busy={loading && items.length === 0}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-secondary">Your spots</h3>
        <div className="flex self-start overflow-hidden rounded-full border border-outline-variant bg-surface-container p-0.5">
          <button
            type="button"
            onClick={() => setKind("saved")}
            aria-pressed={kind === "saved"}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-widest transition-colors ${kind === "saved" ? "bg-primary text-on-primary" : "text-secondary hover:text-on-surface"}`}
          >
            <Heart size={12} /> Saved
          </button>
          <button
            type="button"
            onClick={() => setKind("verified")}
            aria-pressed={kind === "verified"}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-widest transition-colors ${kind === "verified" ? "bg-primary text-on-primary" : "text-secondary hover:text-on-surface"}`}
          >
            <CheckCircle size={12} /> Verified
          </button>
          <button
            type="button"
            onClick={() => setKind("visited")}
            aria-pressed={kind === "visited"}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-widest transition-colors ${kind === "visited" ? "bg-primary text-on-primary" : "text-secondary hover:text-on-surface"}`}
          >
            <MapPinned size={12} /> Visited
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <ProfileSpotsGridSkeleton count={6} />
      ) : items.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-outline-variant bg-surface-container-low p-5 text-center">
          <p className="font-display text-[13px] font-bold uppercase">No {kind} spots</p>
          <p className="mt-1 font-display text-[11px] uppercase tracking-widest text-secondary">
            {kind === "saved" ? "Tap ♥ on any spot to save it" : kind === "verified" ? "Verify spots you’ve checked in person" : "Play a challenge to mark spots as visited"}
          </p>
          <Link href={kind === "visited" ? "/games" : "/"} className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full bg-primary px-4 font-display text-[11px] font-bold uppercase tracking-widest text-on-primary">Explore spots</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <SpotCard key={s.id} spot={s} />
          ))}
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SpotCardSkeleton key={`skeleton-${i}`} />)
            : null}
        </div>
      )}

      {error ? <p className="font-display text-[11px] uppercase tracking-widest text-error">Couldn’t load spots</p> : null}

      <div className="flex min-h-9 justify-center">
        {cursor ? (
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className="min-h-9 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-[11px] font-bold uppercase tracking-widest disabled:opacity-50"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : items.length > 0 ? (
          <span className="inline-flex min-h-9 items-center font-display text-[11px] uppercase tracking-widest text-secondary">End of list</span>
        ) : null}
      </div>
    </div>
  )
}
