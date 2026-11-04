import Link from "next/link";
import { ArrowUpRight, Heart, MapPin } from "lucide-react";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  CARD,
  CARD_NESTED,
  EYEBROW,
  EYEBROW_ON_WASH,
  PAGE_TITLE,
  controlClass,
} from "@/components/ui/recipes";

export const metadata = {
  title: "Thank you for your support",
  description: "Thank you for supporting Open Spot. Your donation helps keep the map open.",
  robots: { index: false, follow: false },
};

export default function ThankYouForSupportPage() {
  return (
    <div className="min-h-full w-full bg-gradient-support text-on-surface">
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-12 md:px-10 md:py-16">
      <section className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:gap-16">
        <div>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface">
            <Heart size={22} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <p className={`mt-10 md:mt-12 ${EYEBROW_ON_WASH}`}>
            Payment received
          </p>
          <h1 className={`mt-3 max-w-3xl ${PAGE_TITLE} md:text-5xl`}>
            Thank you for
            <br />
            supporting Open Spot.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7">
            Your donation helps cover hosting, imagery and map costs, so the map stays open for every rider. PayPal will email you a receipt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/map"
              className={controlClass("primary")}
            >
              Explore the map <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/support"
              className={controlClass("onWash")}
            >
              Back to support
            </Link>
          </div>
        </div>

        <aside className={`self-start ${CARD}`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className={EYEBROW}>What&apos;s next</h2>
            <MapPin size={18} strokeWidth={1.7} aria-hidden="true" className="text-secondary" />
          </div>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">
            Want to help beyond money? Local knowledge is the most useful support. Become a scoped data curator for your country or discipline.
          </p>
          <Link
            href="/support#guidelines"
            className={`mt-5 ${controlClass("secondary")}`}
          >
            How data curation works
          </Link>
          <div className={`mt-5 ${CARD_NESTED}`}>
            <Eyebrow as="p">Coming soon</Eyebrow>
            <p className="mt-1 text-sm font-semibold leading-5 text-on-surface">Buy me a coffee · Patreon</p>
          </div>
        </aside>
      </section>
    </div>
    </div>
  );
}
