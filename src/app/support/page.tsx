import Link from "next/link";
import { ArrowUpRight, Heart, ShieldCheck } from "lucide-react";

// Process to be a data curator: sign in → fill form → admin review → scoped role.
const PAYPAL_URL = "https://www.paypal.com/ncp/payment/8XU46EVXHAVYL";

export const metadata = {
  title: "Support Open Spot",
  description:
    "Support Open Spot through data curation — become a scoped data curator for spots, TV videos or tricks — or support via PayPal.",
};

const guidelines = [
  {
    title: "Know it first-hand",
    body: "Edit only spots, TV videos and tricks you can verify.",
  },
  {
    title: "Stay in scope",
    body: "Spots by country, tricks and TV videos by discipline.",
  },
  {
    title: "Keep data accurate",
    body: "Location, photos, conditions, video details, trick names.",
  },
  {
    title: "Admins grant scopes",
    body: "No scope, no write. Scopes are revocable.",
  },
  {
    title: "Be transparent",
    body: "Edits are audited. Propose changes instead of overwriting.",
  },
];

const scopes = [
  "Spots · country",
  "TV videos · discipline",
  "Tricks · discipline",
];

const steps = ["01 Sign in", "02 Fill the form", "03 Admin review"];

const primaryBtn =
  "inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary bg-primary px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 focus-visible:outline-offset-4";
const secondaryBtn =
  "inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary/30 bg-surface-container-lowest px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-primary hover:bg-surface-container-high focus-visible:outline-offset-4";

export default function SupportPage() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] w-full bg-gradient-explore text-primary">
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-6 sm:py-8 md:px-10 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10 lg:py-6">
        <section>
          <Link
            href="/"
            className="inline-flex min-h-9 items-center rounded-[9999px] border border-primary/30 bg-surface-container-lowest px-4 py-2 font-sans text-xs font-semibold tracking-[0.05em] uppercase transition-colors hover:border-primary focus-visible:outline-offset-4"
          >
            Back to the map
          </Link>
          <p className="mt-6 font-sans text-xs font-semibold tracking-[0.05em] uppercase lg:mt-8">
            Open directory — curated by riders
          </p>
          <h1 className="mt-2 max-w-xl font-display text-[32px] font-bold uppercase leading-[1.15] tracking-[-0.02em] md:text-5xl">
            Support through data curation.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7">
            The most useful support for Open Spot is local knowledge. Scoped
            data curators keep the map honest — only for the countries and
            sports they can verify.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/support/data-curator" className={primaryBtn}>
              Become a data curator{" "}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <a
              href={PAYPAL_URL}
              target="_blank"
              rel="noreferrer noopener"
              className={secondaryBtn}
            >
              Support via PayPal <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <ol
            className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] font-bold uppercase tracking-widest"
            aria-label="How to become a data curator"
          >
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>

        <div className="grid gap-4 mb-16">
          <section
            id="guidelines"
            aria-labelledby="guidelines-title"
            className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="guidelines-title"
                className="font-sans text-xs font-semibold tracking-[0.05em] uppercase"
              >
                Data curation guidelines
              </h2>
              <ShieldCheck
                size={18}
                strokeWidth={1.7}
                aria-hidden="true"
                className="text-secondary"
              />
            </div>
            <ul className="mt-3 grid gap-2">
              {guidelines.map(({ title, body }) => (
                <li
                  key={title}
                  className="text-sm leading-5 text-on-surface-variant"
                >
                  <span className="font-semibold text-on-surface">
                    {title}.
                  </span>{" "}
                  {body}
                </li>
              ))}
            </ul>
            <ul className="mt-4 flex flex-wrap gap-2">
              {scopes.map((scope) => (
                <li
                  key={scope}
                  className="rounded-md bg-surface-container-high px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-secondary"
                >
                  {scope}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="support-options-title"
            className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-surface-container-high text-on-surface">
                  <Heart size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h2
                  id="support-options-title"
                  className="font-display text-xl font-bold uppercase tracking-[-0.02em]"
                >
                  PayPal
                </h2>
              </div>
              <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-on-primary">
                Live
              </span>
            </div>
            <p className="mt-3 text-sm leading-5 text-on-surface-variant">
              One-off support for hosting, imagery and map costs. The map stays
              open. Support via PayPal.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
