"use client";

import Link from "next/link";
import { Trophy, Tv, Globe, Plus, MapPinned } from "lucide-react";
import { NearbyCtaButton } from "@/components/shell/NearbyCtaButton";
import { JoinWithCode } from "@/components/shell/JoinWithCode";
import { ROUTES } from "@/lib/navigation/nav";
import { useUIStore } from "@/stores/ui-store";

export function Hero() {
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative flex h-full min-h-[320px] flex-col justify-center overflow-hidden bg-gradient-to-r from-orange-600 via-red-600 to-red-700 text-on-primary px-5 md:px-8 lg:px-16 xl:px-20 py-auto"
    >
      <div className="mx-auto flex w-full max-w-7xl h-full items-center justify-center">
        <div className="min-w-0 space-y-3 my-auto">
          <div className="flex gap-6 w-full">
            <button
              type="button"
              onClick={tryOpenSearch}
              aria-label="Open search"
              className="inline-flex w-full text-center min-h-9 items-center gap-1.5 rounded-full border border-on-primary bg-on-primary px-5 py-3 font-display text-lg font-bold uppercase tracking-[0.08em] leading-none text-on-primary-container transition-colors duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim active:bg-primary-fixed-dim active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <div className="flex items-center justify-center gap-4 flex-1">
                openspotleague.com
                <Globe size={32} aria-hidden="true" />
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={ROUTES.map}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-on-primary-container px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary transition-colors duration-150 ease-out hover:bg-on-primary-container/90 active:bg-on-primary-container/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <MapPinned size={14} aria-hidden="true" />
              Spots Map
            </Link>

            <Link
              href={ROUTES.games}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-on-primary bg-on-primary px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary-container transition-colors duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim active:bg-primary-fixed-dim active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              Training - challenges - League
              <Trophy size={14} aria-hidden="true" />
            </Link>

            <NearbyCtaButton />
            <Link
              href={ROUTES.tv}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary-container bg-on-primary px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary-container transition-colors duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim active:bg-primary-fixed-dim active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <Tv size={14} aria-hidden="true" />
              TV
            </Link>

            <Link
              href={ROUTES.spotsNew}
              data-testid="create-spot-hero"
              aria-label="Create new spot"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-on-primary-container px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary transition-colors duration-150 ease-out hover:bg-on-primary-container/90 active:bg-on-primary-container/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:hidden"
            >
              <Plus size={14} aria-hidden="true" />
              Spot
            </Link>
            <JoinWithCode variant="landing" />
          </div>
        </div>

        {/* <div className="hidden min-w-0 flex-col gap-3 lg:flex my-auto">
          <div className="rounded-[16px] border border-outline-variant bg-on-primary md:p-6">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] leading-none text-on-surface/60">
              Autoplay
            </p>
            <Link
              href={ROUTES.games}
              className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-primary bg-primary px-3 py-2.5 transition-colors duration-150 ease-out hover:bg-primary/90 hover:shadow-sm active:bg-primary/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              TV Screen
            </Link>
          </div>
        </div> */}
      </div>
    </section>
  );
}
