"use client";

import Link from "next/link";
import {
  MapPin,
  Trophy,
  Tv,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  Gamepad2,
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
    title: "Explore worldwide spots",
    badge: "18+ Spots",
    description: "Skateparks, street spots and DIYs on one map.",
    bullets: [
      "Filter by region, country or city",
      "Ledges, rails, stairs, bowls, vert and DIY builds",
      "Checked by the locals who ride them",
      "Live weather and surface conditions for each spot",
    ],
    ctaText: "Open the Map",
    ctaHref: ROUTES.map,
  },
  {
    icon: Gamepad2,
    title: "Tricks Games",
    badge: "Train or Battle",
    description: "Game of S.K.A.T.E. - B.I.K.E. - B.L.A.D.E. - S.C.O.O.T.",
    bullets: [
      "Miss a trick, take a letter, last rider standing wins",
      "Share a QR code to start a game",
      "Battle mode awards points to the winner",
      "Trick lists by difficulty and type of spot",
    ],
    ctaText: "Start a Game",
    ctaHref: ROUTES.games,
  },
  {
    icon: Tv,
    title: "Open Spot TV",
    badge: "500+ Videos",
    description:
      "Non-stop action sports video: Contests, classic parts and rider profiles, no noise in between.",
    bullets: [
      "Continuous autoplay of curated action sports videos",
      "Filter by discipline and category",
      "+20 years of legendary parts, contests, profiles and more",
      "Most recent videos from the action sports world, all in one place",
    ],
    ctaText: "Watch Open Spot TV",
    ctaHref: ROUTES.tv,
  },
  {
    icon: Trophy,
    title: "riders, Judges, Scores, Podiums & Contests",
    badge: "Create your own contests",
    description:
      "All you need to manage your own contests, from start to finish.",
    bullets: [
      "See the results in real time & save them for later",
      "Easy to use scoring system for judges and riders",
      "Shareable contest pages with live results and podiums",
      "Award scores to each rider and see them ranked on a general leaderboard",
    ],
    ctaText: "Join the League",
    ctaHref: ROUTES.events,
  },
] as const;

export function LandingFeatures() {
  return (
    <section
      aria-labelledby="landing-features-title"
      className="border-b border-outline-variant/60 bg-surface py-12 sm:py-16 px-5 md:px-10"
    >
      <div className="mx-auto max-w-7xl space-y-10 sm:space-y-12">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-2.5">
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
            Join the League
          </p>
          <h2
            id="landing-features-title"
            className="font-display text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-balance text-on-surface"
          >
            Your Spots. Your Tricks. Your League.
          </h2>
          <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
            Map the spots you ride, challenge friends to trick games, join
            community events and track how far you&apos;ve come, across skate,
            BMX, scooter and blade.
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
              Your local spot isn&apos;t on the map yet?
            </h3>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Put it there. Add photos, the exact location and its obstacles,
              and earn curator status in the league.
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
              Join the League
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
