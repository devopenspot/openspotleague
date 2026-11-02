"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, CheckCircle, MapPinned } from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import {
  PROFILE_BODY_CLASS,
  PROFILE_BUTTON_CLASS,
  PROFILE_BUTTON_PRIMARY_CLASS,
  PROFILE_EYEBROW_CLASS,
  PROFILE_SEGMENTS_CLASS,
  profileSegmentClass,
} from "@/components/profile/profile-styles";
import type { Spot } from "@/lib/types";

type Kind = "saved" | "verified" | "visited";

function SpotCard({ spot }: { spot: Spot }) {
  return (
    <Link
      href={`/spots/${spot.id}`}
      className="group overflow-hidden rounded-lg border-2 border-outline-variant bg-surface-container-lowest transition-[border-color,transform] hover:border-outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-container">
        <AppImage
          src={spot.image}
          alt={spot.name}
          fill
          sizes="(min-width: 1024px) 28vw, (min-width: 640px) 42vw, 100vw"
          className="object-cover transition-transform group-hover:scale-[1.02]"
          unoptimized
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="p-3">
        <p className="truncate font-display text-sm font-bold uppercase leading-tight tracking-[0.04em]">
          {spot.name}
        </p>
        <p className={`mt-0.5 truncate ${PROFILE_EYEBROW_CLASS}`}>
          {spot.city} • {spot.country}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {spot.types.slice(0, 3).map((t) => (
            <span
              key={t.slug}
              className="rounded-md bg-surface-container-high px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary"
            >
              {t.name}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function SpotCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-lg border-2 border-outline-variant bg-surface-container-lowest"
    >
      <div className="aspect-[16/10] w-full bg-surface-container-high" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-24 rounded bg-surface-container-high" />
        <div className="h-4 w-32 rounded bg-surface-container-high" />
        <div className="flex gap-1">
          <div className="h-6 w-16 rounded-md bg-surface-container-high" />
          <div className="h-6 w-20 rounded-md bg-surface-container-high" />
        </div>
      </div>
    </div>
  );
}

export function ProfileSpotsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 "
    >
      {Array.from({ length: count }).map((_, i) => (
        <SpotCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProfileSpotsGrid() {
  const [kind, setKind] = useState<Kind>("saved");
  const [items, setItems] = useState<readonly Spot[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  // Bumped on every load; responses from a superseded load are discarded so a
  // quick kind switch can never append stale results into the newer list.
  const loadGenerationRef = useRef(0);

  const load = async (reset = false) => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ kind, limit: "12" });
      if (!reset && cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/profile/spots?${params.toString()}`);
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as {
        items: readonly Spot[];
        nextCursor: string | null;
      };
      if (generation !== loadGenerationRef.current) return;
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setError(true);
    } finally {
      if (generation === loadGenerationRef.current) setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setItems([]);
    setCursor(null);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="space-y-3" aria-busy={loading && items.length === 0}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <h3 className={PROFILE_EYEBROW_CLASS}>Your spots</h3>
        <div className={`self-start ${PROFILE_SEGMENTS_CLASS}`}>
          <button
            type="button"
            onClick={() => setKind("saved")}
            aria-pressed={kind === "saved"}
            className={profileSegmentClass(kind === "saved")}
          >
            <Heart size={14} /> Saved
          </button>
          <button
            type="button"
            onClick={() => setKind("verified")}
            aria-pressed={kind === "verified"}
            className={profileSegmentClass(kind === "verified")}
          >
            <CheckCircle size={14} /> Verified
          </button>
          <button
            type="button"
            onClick={() => setKind("visited")}
            aria-pressed={kind === "visited"}
            className={profileSegmentClass(kind === "visited")}
          >
            <MapPinned size={14} /> Visited
          </button>
        </div>
      </div>

      {loading && items.length === 0 ? (
        <ProfileSpotsGridSkeleton count={6} />
      ) : items.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-outline-variant bg-surface-container-low p-5 text-center">
          <p className="font-display text-sm font-bold uppercase tracking-[0.04em]">
            No {kind} spots
          </p>
          <p className={`mt-1 ${PROFILE_BODY_CLASS}`}>
            {kind === "saved"
              ? "Tap ♥ on any spot to save it"
              : kind === "verified"
                ? "Verify spots you’ve checked in person"
                : "Play a challenge to mark spots as visited"}
          </p>
          <Link
            href={kind === "visited" ? "/games" : "/"}
            className={`mt-3 ${PROFILE_BUTTON_PRIMARY_CLASS}`}
          >
            Explore spots
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <SpotCard key={s.id} spot={s} />
          ))}
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <SpotCardSkeleton key={`skeleton-${i}`} />
              ))
            : null}
        </div>
      )}

      {error ? (
        <p className="text-sm font-semibold leading-5 text-error">
          Couldn’t load spots
        </p>
      ) : null}

      <div className="flex min-h-12 justify-center">
        {cursor ? (
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className={`${PROFILE_BUTTON_CLASS} disabled:opacity-50`}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : items.length > 0 ? (
          <span
            className={`inline-flex min-h-12 items-center ${PROFILE_EYEBROW_CLASS}`}
          >
            End of list
          </span>
        ) : null}
      </div>
    </div>
  );
}
