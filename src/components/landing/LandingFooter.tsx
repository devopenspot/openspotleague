"use client";

import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/navigation/nav";

export function LandingFooter() {
  return (
    <footer
      aria-label="Site footer"
      className="border-t border-wire-border bg-wire text-on-wire py-12 px-4 sm:px-6 md:px-10"
    >
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-2 space-y-3">
            <Link
              href={ROUTES.home}
              className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Image
                src="/logo.png"
                alt="Open Spot League"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="font-display text-lg font-extrabold uppercase tracking-tight text-on-wire">
                Open Spot League
              </span>
            </Link>
            <p className="max-w-sm text-xs leading-relaxed text-wire-muted">
              The global action sports directory and challenge network. Discover spots, train with friends, and participate in community contests across 12 worldwide regions.
            </p>
          </div>

          {/* Directory Column */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-on-wire">
              Explore
            </h4>
            <ul className="space-y-2 text-xs text-wire-muted">
              <li>
                <Link
                  href={ROUTES.map}
                  className="transition-colors hover:text-on-wire"
                >
                  Spots Map
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.games}
                  className="transition-colors hover:text-on-wire"
                >
                  Challenge Arena
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.tv}
                  className="transition-colors hover:text-on-wire"
                >
                  Open Spot TV
                </Link>
              </li>
              <li>
                <Link
                  href="/sport-events"
                  className="transition-colors hover:text-on-wire"
                >
                  Contests & Events
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.spotsNew}
                  className="transition-colors hover:text-on-wire"
                >
                  Submit a Spot
                </Link>
              </li>
            </ul>
          </div>

          {/* Disciplines Column */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-on-wire">
              Disciplines
            </h4>
            <ul className="space-y-2 text-xs text-wire-muted">
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=skateboard`}
                  className="transition-colors hover:text-on-wire"
                >
                  Skateboarding
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=bmx`}
                  className="transition-colors hover:text-on-wire"
                >
                  BMX Freestyle
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=roller`}
                  className="transition-colors hover:text-on-wire"
                >
                  Aggressive Inline
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=scooter`}
                  className="transition-colors hover:text-on-wire"
                >
                  Freestyle Scooter
                </Link>
              </li>
            </ul>
          </div>

          {/* Account & Trust */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-on-wire">
              Riders
            </h4>
            <ul className="space-y-2 text-xs text-wire-muted">
              <li>
                <Link
                  href={ROUTES.login}
                  className="transition-colors hover:text-on-wire"
                >
                  Rider Sign In
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.profile}
                  className="transition-colors hover:text-on-wire"
                >
                  Rider Profile
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.saved}
                  className="transition-colors hover:text-on-wire"
                >
                  Saved Spots
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className="transition-colors hover:text-on-wire"
                >
                  Support & Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-bold uppercase tracking-[0.12em] text-on-wire">
              Legal
            </h4>
            <ul className="space-y-2 text-xs text-wire-muted">
              <li>
                <Link
                  href={ROUTES.terms}
                  className="transition-colors hover:text-on-wire"
                >
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.privacy}
                  className="transition-colors hover:text-on-wire"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.terms}#risk-waiver`}
                  className="transition-colors hover:text-on-wire"
                >
                  Safety & Risk Waiver
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.terms}#spots-property`}
                  className="transition-colors hover:text-on-wire"
                >
                  Spot Takedown / DMCA
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-wire-border pt-6 text-[11px] text-wire-muted">
          <p>© {new Date().getFullYear()} Open Spot League. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={ROUTES.terms}
              className="transition-colors hover:text-on-wire underline decoration-wire-border"
            >
              Terms
            </Link>
            <span aria-hidden="true">•</span>
            <Link
              href={ROUTES.privacy}
              className="transition-colors hover:text-on-wire underline decoration-wire-border"
            >
              Privacy
            </Link>
            <span aria-hidden="true">•</span>
            <span className="text-wire-muted">Ride at your own risk. Helmets save lives.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
