import Link from "next/link";
import { ArrowUpRight, Heart, MapPin } from "lucide-react";

export const metadata = {
  title: "Thank you for your support",
  description: "Thank you for supporting Open Spot. Your donation helps keep the map open.",
  robots: { index: false, follow: false },
};

export default function ThankYouForSupportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-12 md:px-10 md:py-16">
      <section className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:gap-16">
        <div>
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-surface-container-high text-on-surface">
            <Heart size={22} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <p className="mt-10 font-sans text-xs font-semibold tracking-[0.05em] text-secondary uppercase md:mt-12">
            Payment received
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[32px] font-bold uppercase leading-[1.2] tracking-[-0.02em] md:text-5xl">
            Thank you for
            <br />
            supporting Open Spot.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-on-surface-variant">
            Your donation helps cover hosting, imagery and map costs, so the map stays open for every rider. PayPal will email you a receipt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/map"
              className="inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 focus-visible:outline-offset-4"
            >
              Explore the map <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <Link
              href="/support"
              className="inline-flex min-h-11 items-center rounded-[9999px] border border-outline-variant bg-surface-container-high px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-offset-4"
            >
              Back to support
            </Link>
          </div>
        </div>

        <aside className="self-start rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-xs font-semibold tracking-[0.05em] uppercase">What&apos;s next</h2>
            <MapPin size={18} strokeWidth={1.7} aria-hidden="true" className="text-secondary" />
          </div>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">
            Want to help beyond money? Local knowledge is the most useful support. Become a scoped data curator for your country or discipline.
          </p>
          <Link
            href="/support#guidelines"
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-outline-variant bg-surface-container-high px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-offset-4"
          >
            How data curation works
          </Link>
          <div className="mt-5 rounded-[16px] border border-outline-variant bg-surface-container-low px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">Coming soon</p>
            <p className="mt-1 font-sans text-xs font-semibold leading-5 text-on-surface">Buy me a coffee · Patreon</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
