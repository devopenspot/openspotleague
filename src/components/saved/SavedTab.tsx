"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Heart, ShieldCheck, Plus } from "lucide-react";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useSavedSpotList } from "@/hooks/data/useSavedSpotList";
import { useVerifiedSpots } from "@/hooks/data/useVerifiedSpots";
import { useVerifiedSpotList } from "@/hooks/data/useVerifiedSpotList";
import { useCreatedSpots } from "@/hooks/data/useCreatedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { ROUTES } from "@/lib/navigation/nav";
import { SavedSpotCard } from "@/components/spots/card/SpotCard";
import Header from "@/components/saved/Header";

type Filter = "created" | "saved" | "verified";

export default function SavedTab() {
  const router = useRouter();
  const user = useUser();
  const { savedIds, toggle: toggleSaved } = useSavedSpots(user?.id ?? null);
  const { verifiedIds, toggle: toggleVerified } = useVerifiedSpots(
    user?.id ?? null,
  );
  // Saved and verified entities are fetched on mount (`/api/saved-spots`,
  // `/api/verified-spots/mine`) — the SSR contexts only carry head rows
  // (ids), avoiding 200 full spot objects in every route's RSC flight.
  const { items: savedSpots } = useSavedSpotList(user?.id ?? null, savedIds);
  const { items: verifiedSpots } = useVerifiedSpotList(
    user?.id ?? null,
    verifiedIds,
  );
  const { items: createdItems } = useCreatedSpots(user?.id ?? null);
  const [filter, setFilter] = useState<Filter>("saved");

  // Created spots come from dedicated endpoint (includes personal), not store
  const createdSpots = createdItems;

  const openSpot = (spot: { id: string }) => router.push(ROUTES.spot(spot.id));

  const counts = useMemo(
    () => ({
      created: createdSpots.length,
      saved: savedSpots.length,
      verified: verifiedSpots.length,
    }),
    [createdSpots.length, savedSpots.length, verifiedSpots.length],
  );

  const activeItems =
    filter === "created"
      ? createdSpots
      : filter === "verified"
        ? verifiedSpots
        : savedSpots;

  const emptyForFilter = {
    created: {
      title: "No spots you added yet",
      desc: "Spots you create start as personal — only you see them. After a second rider adds one within 300 m, they become public with a Community badge.",
    },
    saved: {
      title: "No saved spots",
      desc: "Sift through our curated directory, tap the heart emblem, and compile your local blueprint for rapid reference.",
    },
    verified: {
      title: "No verified spots",
      desc: "Tap the shield on a spot card to confirm it's legit. Your verification helps the community surface real terrain.",
    },
  }[filter];

  return (
    <section
      id="saved-tab"
      role="tabpanel"
      aria-labelledby="nav-btn-saved"
      className="space-y-6 py-6 animate-fade-in sm:py-8"
    >
      <Header />

      <div className="flex flex-wrap items-center gap-3 px-5 md:px-10">
        <div
          role="tablist"
          aria-label="Saved collections"
          className="inline-flex gap-2 rounded-full bg-surface-container p-1 border border-outline-variant"
        >
          {(["created", "saved", "verified"] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              aria-controls={`panel-${f}`}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.05em] transition-colors ${filter === f ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`}
            >
              {f}{" "}
              <span
                className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${filter === f ? "bg-on-primary/20 text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
        <Link
          href={ROUTES.spotsNew}
          data-testid="create-spot-saved"
          aria-label="Create new spot"
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface px-4 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:hidden"
        >
          <Plus size={12} aria-hidden="true" />
          Spot
        </Link>
      </div>

      {activeItems.length === 0 ? (
        <div
          id={`panel-${filter}`}
          role="tabpanel"
          aria-labelledby={`tab-${filter}`}
          className="mx-5 mt-2 flex max-w-lg flex-col items-center justify-center rounded-[16px] border border-outline-variant bg-surface-container-lowest p-6 text-center sm:mx-auto sm:p-8"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] border border-outline-variant bg-surface-container-high text-secondary">
            {filter === "created" ? (
              <Plus size={20} aria-hidden />
            ) : filter === "verified" ? (
              <ShieldCheck size={20} aria-hidden />
            ) : (
              <Heart size={20} aria-hidden />
            )}
          </div>
          <h2 className="font-display text-xl font-bold uppercase leading-[1.4] tracking-[-0.02em] text-on-surface">
            {emptyForFilter.title}
          </h2>
          <p className="mt-3 max-w-sm text-base leading-7 text-on-surface-variant">
            {emptyForFilter.desc}
          </p>
          {filter === "created" ? (
            <Link
              href={ROUTES.spotsNew}
              data-testid="create-spot-saved-empty"
              aria-label="Create new spot"
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:hidden"
            >
              <Plus size={14} aria-hidden="true" /> Spot
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase"
            >
              <Compass size={14} aria-hidden /> Explore
            </button>
          )}
        </div>
      ) : (
        <div
          id={`panel-${filter}`}
          role="tabpanel"
          className="grid grid-cols-1 gap-6 px-5 sm:grid-cols-2 lg:grid-cols-3 md:px-10"
        >
          {activeItems.map((spot) => {
            const isCommunity =
              (spot as unknown as { origin?: string }).origin === "community";
            const isPersonal =
              (spot as unknown as { visibility?: string }).visibility ===
              "personal";
            return (
              <div key={spot.id} className="relative">
                {isCommunity || isPersonal ? (
                  <span
                    className={`absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border ${isCommunity ? "bg-primary text-on-primary border-primary" : "bg-amber-50 text-amber-900 border-amber-200"}`}
                  >
                    {isCommunity ? "Community" : "Private"}
                  </span>
                ) : null}
                <SavedSpotCard
                  spot={
                    spot as unknown as Parameters<
                      typeof SavedSpotCard
                    >[0]["spot"]
                  }
                  isSaved={savedIds.has(spot.id)}
                  isVerified={verifiedIds.has(spot.id)}
                  onOpen={openSpot}
                  onToggleSave={toggleSaved}
                  onToggleVerify={toggleVerified}
                  className="!rounded-[16px] !bg-surface-container-lowest [&_button]:rounded-[16px] [&_a]:rounded-[16px] [&_[aria-pressed=true]]:border-primary [&_[aria-pressed=true]]:bg-primary [&_[aria-pressed=true]]:text-on-primary"
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
