"use client";

import Link from "next/link";
import { Trophy, Tv, Plus, Search } from "lucide-react";
import { NearbyCtaButton } from "@/components/shell/NearbyCtaButton";
import { JoinWithCode } from "@/components/shell/JoinWithCode";
import { ROUTES } from "@/lib/navigation/nav";
import { useUIStore } from "@/stores/ui-store";

export function Hero() {
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative flex w-full shrink-0 flex-col justify-center bg-gradient-primary text-on-primary px-4 sm:px-6 md:px-8 lg:px-16 pt-8 pb-10 sm:py-14 md:py-16"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
        <div className="w-full min-w-0 space-y-4 sm:space-y-5 text-center">
          {/* Discipline Badges */}
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-white backdrop-blur-md">
            <span>Skateboard</span>
            <span className="opacity-40">•</span>
            <span>BMX</span>
            <span className="opacity-40">•</span>
            <span>roller</span>
            <span className="opacity-40">•</span>
            <span>Scooter</span>
          </div>

          {/* Accessible Semantic H1 */}
          <div className="space-y-1 sm:space-y-2">
            <h1
              id="landing-hero-title"
              className="font-display text-2xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-white leading-tight"
            >
              Discover Spots. Track Training.
            </h1>
            <p className="mx-auto max-w-xl text-xs sm:text-sm md:text-base font-normal text-white/90 leading-relaxed">
              The open action sports network to explore 15,000+ street spots and
              skateparks, battle in live trick challenges, and watch community
              clips.
            </p>
          </div>

          {/* Interactive Search Bar Button */}
          <div className="w-full max-w-xl mx-auto pt-1">
            <button
              type="button"
              onClick={tryOpenSearch}
              aria-label="Search spots, skateparks, and cities"
              className="group flex w-full min-h-[48px] sm:min-h-[52px] items-center justify-between gap-3 rounded-full border border-on-primary bg-on-primary px-4 sm:px-5 py-2.5 shadow-lg transition-all duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim hover:shadow-xl active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent cursor-pointer"
            >
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 text-on-primary-container">
                <Search
                  size={18}
                  className="shrink-0 text-secondary transition-colors group-hover:text-on-surface"
                  aria-hidden="true"
                />
                <span className="truncate text-left text-xs sm:text-sm font-medium text-secondary group-hover:text-on-surface">
                  Search spots, skateparks, or cities...
                </span>
              </div>
              <kbd className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-md border border-outline-variant/60 bg-surface-container-high px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-secondary">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Action Pills Row */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 pt-2 sm:pt-3">
            <NearbyCtaButton />
            <Link
              href={ROUTES.tv}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary-container bg-on-primary px-4 sm:px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary-container transition-colors duration-150 ease-out hover:bg-primary-fixed hover:border-primary-fixed-dim active:bg-primary-fixed-dim active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <Tv size={14} aria-hidden="true" />
              TV
            </Link>

            <Link
              href={ROUTES.games}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-on-primary-container px-4 sm:px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary transition-colors duration-150 ease-out  hover:bg-on-primary-container/90 active:bg-on-primary-container/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            >
              <Trophy size={14} aria-hidden="true" />
              Training - Challenges - League
            </Link>

            <Link
              href={ROUTES.spotsNew}
              data-testid="create-spot-hero"
              aria-label="Create new spot"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-on-primary-container px-4 sm:px-5 py-2 font-display text-[11px] font-bold uppercase tracking-[0.08em] leading-none text-on-primary transition-colors duration-150 ease-out hover:bg-on-primary-container/90 active:bg-on-primary-container/85 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:hidden"
            >
              <Plus size={14} aria-hidden="true" />
              Spot
            </Link>

            <JoinWithCode variant="landing" />
          </div>
        </div>
      </div>
    </section>
  );
}
