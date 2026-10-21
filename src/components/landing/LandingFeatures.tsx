"use client";

import Link from "next/link";
import {
  MapPin,
  Trophy,
  Tv,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  BookmarkCheck,
} from "lucide-react";
import { ROUTES } from "@/lib/navigation/nav";

interface FeatureCardProps {
  icon: typeof MapPin;
  title: string;
  badge: string;
  description: string;
  bullets: readonly string[];
  ctaText: string;
  ctaHref: string;
}

const FEATURES: readonly FeatureCardProps[] = [
  {
    icon: MapPin,
    title: "Global Spot Directory",
    badge: "26k+ Spots",
    description:
      "Interactive map with coordinates, obstacles, surface ratings, security bust index, and live weather at every spot.",
    bullets: [
      "Filter by discipline: Skate, BMX, Roller & Scooter",
      "Street ledges, handrails, stair sets, bowls & DIYs",
      "Crowd-sourced verifications from local riders",
    ],
    ctaText: "Explore Spot Map",
    ctaHref: ROUTES.map,
  },
  {
    icon: Trophy,
    title: "Live Challenge Engine",
    badge: "Battle Mode",
    description:
      "Play Game of S.K.A.T.E., B.I.K.E., R.O.L.L.E.R. or S.C.O.O.T. Turn-based referee rules, custom letter words, and live session sync.",
    bullets: [
      "Customizable elimination word & offensive calls",
      "Quick 6-character room codes to invite rivals",
      "Trick catalogs with difficulty levels & capability matching",
    ],
    ctaText: "Launch Training & Games",
    ctaHref: ROUTES.games,
  },
  {
    icon: Tv,
    title: "Open Spot TV",
    badge: "380+ Videos",
    description:
      "Curated non-stop action sports cinema. Stream FISE world cups, street video parts, and athlete profile sessions without noise.",
    bullets: [
      "Zero-friction continuous autoplay across disciplines",
      "Filter by Skate, BMX, Roller, and Scooter",
      "Deep links directly into specific contest runs and parts",
    ],
    ctaText: "Watch Open Spot TV",
    ctaHref: ROUTES.tv,
  },
  {
    icon: BookmarkCheck,
    title: "Rider Progression",
    badge: "Free Account",
    description:
      "Save your favorite training grounds, track your trick bag, and contribute new unmapped street spots to the community.",
    bullets: [
      "Bookmark spots to ride and access them on mobile",
      "Record match history and personal trick progression",
      "Submit local gems with photos & obstacle tags",
    ],
    ctaText: "Sign In / Join Free",
    ctaHref: ROUTES.login,
  },
] as const;

export function LandingFeatures() {
  return (
    <section
      aria-labelledby="landing-features-title"
      className="border-b border-outline-variant/60 bg-surface py-12 sm:py-16 px-4 sm:px-6 md:px-10"
    >
      <div className="mx-auto max-w-7xl space-y-10 sm:space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5">
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
            Core Platform Pillars
          </p>
          <h2
            id="landing-features-title"
            className="font-display text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-on-surface"
          >
            Built for Riders Worldwide
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Everything you need to discover terrain, train tricks with friends, and stay plugged into global action sports.
          </p>
        </div>

        {/* 4 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group relative flex flex-col justify-between rounded-lg border border-outline-variant/70 bg-surface-container-lowest p-6 sm:p-7 shadow-xs transition-all duration-150 hover:border-outline hover:shadow-md"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-high text-on-surface group-hover:bg-primary group-hover:text-on-primary transition-colors">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
                      {feature.badge}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-display text-lg sm:text-xl font-bold uppercase tracking-tight text-on-surface">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  <ul className="space-y-2 pt-1 border-t border-outline-variant/40">
                    {feature.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-xs text-on-surface-variant/90"
                      >
                        <ShieldCheck
                          size={14}
                          className="mt-0.5 shrink-0 text-secondary"
                          aria-hidden="true"
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-4 border-t border-outline-variant/40">
                  <Link
                    href={feature.ctaHref}
                    className="inline-flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface transition-colors hover:text-primary group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>{feature.ctaText}</span>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Callout Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-low p-6 sm:p-8">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-display text-base sm:text-lg font-bold uppercase tracking-tight text-on-surface">
              Know a local spot that isn&apos;t on the map?
            </h3>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Help map your city. Submit photos, coordinates, and obstacles to earn curator status.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href={ROUTES.spotsNew}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-5 py-2 font-display text-xs font-bold uppercase tracking-[0.08em] text-on-primary transition-colors hover:bg-primary/90"
            >
              <PlusCircle size={16} aria-hidden="true" />
              Add a Spot
            </Link>
            <Link
              href={ROUTES.login}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2 font-display text-xs font-bold uppercase tracking-[0.08em] text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Join the Community
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
