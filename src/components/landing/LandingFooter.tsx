"use client";

import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/lib/navigation/nav";

const FOOTER_LINK_CLASS =
  "transition-colors hover:text-on-wire focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2";

export function LandingFooter() {
  return (
    <footer
      aria-label="Site footer"
      className="border-t border-wire-border bg-wire text-on-wire px-5 sm:px-6 lg:px-10 py-8 sm:py-10 md:py-12"
    >
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand Column */}
          <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-2 space-y-3">
            <Link
              href={ROUTES.home}
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
            >
              <Image
                src="/logo.png"
                alt="Open Spot League"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
              />
              <span className="font-display text-lg font-bold uppercase tracking-[-0.02em] text-on-wire">
                Open Spot League
              </span>
            </Link>
            <p className="max-w-sm text-sm font-semibold leading-5 text-wire-muted">
              The global action sports directory and challenge network. Discover
              spots, train with friends, and participate in community contests
              across 12 worldwide regions.
            </p>
          </div>

          {/* Directory Column */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-wire">
              Explore
            </h4>
            <ul className="space-y-2 text-sm font-semibold text-wire-muted">
              <li>
                <Link
                  href={ROUTES.map}
                  className={FOOTER_LINK_CLASS}
                >
                  Spots Map
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.games}
                  className={FOOTER_LINK_CLASS}
                >
                  Challenge Arena
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.tv}
                  className={FOOTER_LINK_CLASS}
                >
                  Open Spot TV
                </Link>
              </li>
              <li>
                <Link
                  href="/sport-events"
                  className={FOOTER_LINK_CLASS}
                >
                  Contests & Events
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.spotsNew}
                  className={FOOTER_LINK_CLASS}
                >
                  Submit a Spot
                </Link>
              </li>
            </ul>
          </div>

          {/* Disciplines Column */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-wire">
              Disciplines
            </h4>
            <ul className="space-y-2 text-sm font-semibold text-wire-muted">
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=skateboard`}
                  className={FOOTER_LINK_CLASS}
                >
                  Skateboarding
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=bmx`}
                  className={FOOTER_LINK_CLASS}
                >
                  BMX Freestyle
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=roller`}
                  className={FOOTER_LINK_CLASS}
                >
                  Aggressive Inline
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.map}?discipline=scooter`}
                  className={FOOTER_LINK_CLASS}
                >
                  Freestyle Scooter
                </Link>
              </li>
            </ul>
          </div>

          {/* Account & Trust */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-wire">
              Riders
            </h4>
            <ul className="space-y-2 text-sm font-semibold text-wire-muted">
              <li>
                <Link
                  href={ROUTES.login}
                  className={FOOTER_LINK_CLASS}
                >
                  Rider Sign In
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.profile}
                  className={FOOTER_LINK_CLASS}
                >
                  Rider Profile
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.saved}
                  className={FOOTER_LINK_CLASS}
                >
                  Saved Spots
                </Link>
              </li>
              <li>
                <Link
                  href="/support"
                  className={FOOTER_LINK_CLASS}
                >
                  Support & Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Column */}
          <div className="space-y-3">
            <h4 className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-on-wire">
              Legal
            </h4>
            <ul className="space-y-2 text-sm font-semibold text-wire-muted">
              <li>
                <Link
                  href={ROUTES.terms}
                  className={FOOTER_LINK_CLASS}
                >
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.privacy}
                  className={FOOTER_LINK_CLASS}
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.terms}#risk-waiver`}
                  className={FOOTER_LINK_CLASS}
                >
                  Safety & Risk Waiver
                </Link>
              </li>
              <li>
                <Link
                  href={`${ROUTES.terms}#spots-property`}
                  className={FOOTER_LINK_CLASS}
                >
                  Spot Takedown / DMCA
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-wire-border pt-6 text-xs font-semibold text-wire-muted">
          <p>
            © {new Date().getFullYear()} Open Spot League. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={ROUTES.terms}
              className={`${FOOTER_LINK_CLASS} underline decoration-wire-border`}
            >
              Terms
            </Link>
            <span aria-hidden="true">•</span>
            <Link
              href={ROUTES.privacy}
              className={`${FOOTER_LINK_CLASS} underline decoration-wire-border`}
            >
              Privacy
            </Link>
            <span aria-hidden="true">•</span>
            <span className="text-wire-muted">
              Ride at your own risk. Helmets save lives.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
