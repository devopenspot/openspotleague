"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, CheckCircle, MapPinned } from "lucide-react";
import { AppImage } from "@/components/ui/AppImage";
import { BODY, EMPTY_STATE, META, SEGMENTED_TRACK, controlClass, segmentClass, tagClass } from "@/components/ui/recipes";
import { ROUTES } from "@/lib/navigation/nav";
import type { Spot } from "@/lib/types";
import { formatCount } from "@/components/profile/format";

type Kind = "saved" | "verified" | "visited";

const KINDS: readonly { id: Kind; label: string; icon: typeof Heart }[] = [
  { id: "saved", label: "Saved", icon: Heart },
  { id: "verified", label: "Verified", icon: CheckCircle },
  { id: "visited", label: "Visited", icon: MapPinned },
];

const EMPTY_COPY: Record<Kind, { hint: string; cta: string; href: string }> = {
  saved: { hint: "Tap the heart on any spot to keep it here.", cta: "Explore spots", href: ROUTES.home },
  verified: { hint: "Verify a spot when you check it out in person.", cta: "Explore spots", href: ROUTES.home },
  visited: { hint: "Spots you verify or play a game at show up here.", cta: "Go to Games", href: ROUTES.games },
};

function SpotCard({ spot }: { spot: Spot }) {
  return (
    <Link
      href={`/spots/${spot.id}`}
      className="group overflow-hidden rounded-container border border-outline-variant bg-surface-container-lowest transition-[border-color,transform] hover:border-outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
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
        <p className="truncate font-display text-sm font-bold uppercase leading-tight tracking-dense">
          {spot.name}
        </p>
        <p className={`mt-0.5 truncate ${META}`}>
          {spot.city} • {spot.country}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {spot.types.slice(0, 3).map((t) => (
            <span
              key={t.slug}
              className={tagClass("neutral")}
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
      className="overflow-hidden rounded-container border border-outline-variant bg-surface-container-lowest"
    >
      <div className="aspect-[16/10] w-full bg-surface-container-high" />
      <div className="p-3 space-y-2">
        <div className="h-4 w-24 rounded bg-surface-container-high" />
        <div className="h-4 w-32 rounded bg-surface-container-high" />
        <div className="flex gap-1">
          <div className="h-6 w-16 rounded-control bg-surface-container-high" />
          <div className="h-6 w-20 rounded-control bg-surface-container-high" />
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

export function ProfileSpotsGrid({
  counts,
}: {
  /** Totals from the profile summary, shown on each segment. */
  counts?: Readonly<Record<Kind, number>>;
} = {}) {
  const [kind, setKind] = useState<Kind>("saved");
  const [items, setItems] = useState<readonly Spot[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
      <div className={`sm:max-w-md ${SEGMENTED_TRACK}`} role="group" aria-label="Spot list">
        {KINDS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            aria-pressed={kind === id}
            className={segmentClass(kind === id)}
          >
            <Icon size={14} aria-hidden="true" /> {label}
            {counts ? <span className="tabular-nums opacity-70">{formatCount(counts[id])}</span> : null}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <ProfileSpotsGridSkeleton count={6} />
      ) : items.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p className="font-display text-sm font-bold uppercase tracking-dense">
            No {kind} spots
          </p>
          <p className={`mt-1 ${BODY}`}>{EMPTY_COPY[kind].hint}</p>
          <Link href={EMPTY_COPY[kind].href} className={`mt-3 ${controlClass("primary")}`}>
            {EMPTY_COPY[kind].cta}
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
        <p className="text-sm leading-5 text-error">
          Couldn’t load spots
        </p>
      ) : null}

      {cursor ? (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className={`${controlClass("outline")} disabled:opacity-50`}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
