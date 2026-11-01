"use client";

import Link from "next/link";
import { Trophy, Tv, Plus, Search } from "lucide-react";
import { NearbyCtaButton } from "@/components/shell/NearbyCtaButton";
import { JoinWithCode } from "@/components/shell/JoinWithCode";
import { ROUTES } from "@/lib/navigation/nav";
import { useUIStore } from "@/stores/ui-store";
import { HERO_DESCRIPTION, HERO_TITLE } from "./hero.messages";

export function Hero() {
  const tryOpenSearch = useUIStore((s) => s.tryOpenSearch);

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative flex w-full shrink-0 flex-col justify-center bg-gradient-primary text-on-primary px-5 sm:px-6 lg:px-10 py-6 sm:py-10 md:py-12"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
        <div className="w-full min-w-0 space-y-4 sm:space-y-5 text-center">
          {/* Discipline Badges */}
          <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 rounded-lg border border-white/20 bg-black/20 px-3 sm:px-4 py-1.5 font-display text-[10px] sm:text-xs font-semibold uppercase tracking-[0.05em] text-white backdrop-blur-md">
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
              className="font-display text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-[-0.02em] text-white leading-[1.3] sm:leading-[1.15]"
            >
              {HERO_TITLE}
            </h1>
            <p className="mx-auto max-w-xl text-sm md:text-base font-semibold text-white/90 leading-5 md:leading-6">
              {HERO_DESCRIPTION}
            </p>
          </div>

          {/* Interactive Search Bar Button */}
          <div className="w-full max-w-xl mx-auto pt-1">
            <button
              type="button"
              onClick={tryOpenSearch}
              aria-label="Search spots, skateparks, and cities"
              className="group flex w-full min-h-12 items-center justify-between gap-3 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 transition-[background-color,transform] hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px cursor-pointer"
            >
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 text-on-primary-container">
                <Search
                  size={18}
                  className="shrink-0 text-secondary transition-colors group-hover:text-on-surface"
                  aria-hidden="true"
                />
                <span className="truncate text-left text-sm font-semibold text-secondary group-hover:text-on-surface">
                  Search spots, skateparks, or cities...
                </span>
              </div>
              <kbd className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-md border border-outline-variant/60 bg-surface-container-high px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-secondary">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Action Pills Row */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <NearbyCtaButton />
            <Link
              href={ROUTES.tv}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
            >
              <Tv size={14} aria-hidden="true" />
              TV
            </Link>

            <Link
              href={ROUTES.games}
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-on-primary-container bg-on-primary-container px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-on-primary-container/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
            >
              <Trophy size={14} aria-hidden="true" />
              Training - Challenges - League
            </Link>

            <Link
              href={ROUTES.spotsNew}
              data-testid="create-spot-hero"
              aria-label="Create new spot"
              className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-on-primary-container bg-on-primary-container px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-on-primary-container/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px md:hidden"
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
