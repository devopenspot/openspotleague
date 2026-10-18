import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  Coffee,
  HandHeart,
  LogIn,
  MapPin,
  ShieldCheck,
  Trophy,
} from "lucide-react";

// Dummy Google Form — replace with NEXT_PUBLIC_CURATOR_FORM_URL when live.
// Process to be a curator: sign in → fill form → admin review → scoped role.
const CURATOR_FORM_URL = "https://forms.gle/placeholder-curator-apply";

export const metadata = {
  title: "Support Open Spot",
  description:
    "Support Open Spot through curation — become a scoped curator for spots, events or tricks. Patron support coming soon.",
};

const curatorRoles = [
  {
    icon: MapPin,
    title: "Spot curators",
    kicker: "By country",
    body: "Keep location, photos, conditions and spot types honest for the countries you ride. Scope is a country (ISO2) from curator_country_scopes.",
  },
  {
    icon: CalendarDays,
    title: "Event curators",
    kicker: "By country",
    body: "Maintain dates, tiers, venues and featured listings for your circuit. Same country scoping as spots.",
  },
  {
    icon: Trophy,
    title: "Trick curators",
    kicker: "By discipline",
    body: "Edit trick catalogs per sport — skateboard, bmx, scooter, roller — via curator_discipline_scopes. Games keep immutable snapshots.",
  },
];

const curatorSteps = [
  {
    step: "01",
    title: "Sign in",
    body: "Create or open your Open Spot account. You need a real session to be granted a curator role.",
    action: { label: "Sign in", href: "/login", icon: LogIn, primary: false },
  },
  {
    step: "02",
    title: "Fill the form",
    body: "Tell us where you ride and what you can verify. Country for spots/events, discipline for tricks.",
    action: { label: "Fill curator application", href: CURATOR_FORM_URL, icon: ArrowUpRight, primary: true, external: true },
  },
  {
    step: "03",
    title: "Get access",
    body: "Admins review scopes in /admin/users. If approved, Curation appears in navigation and your work areas at /admin/curation.",
    action: { label: "How curation works", href: "#curators", icon: ClipboardList, primary: false },
  },
];

const comingSoon = [
  {
    title: "Buy me a coffee",
    body: "One-off support for hosting, imagery and map costs. No paywall — the map stays open.",
    icon: Coffee,
  },
  {
    title: "Patreon",
    body: "Monthly backing for moderation and events coverage. Transparent use of funds when live.",
    icon: HandHeart,
  },
];

export default function SupportPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:py-12 md:px-10 md:py-16">
      {/* Hero */}
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:gap-16">
        <section>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-[9999px] border border-outline-variant bg-surface-container-high px-4 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-offset-4"
          >
            Back to the map
          </Link>
          <p className="mt-10 font-sans text-xs font-semibold tracking-[0.05em] text-secondary uppercase md:mt-16">
            Open directory — curated by riders
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-[32px] font-bold uppercase leading-[1.2] tracking-[-0.02em] md:text-5xl">
            Support
            <br />
            through curation.
          </h1>
          <p className="mt-8 max-w-xl text-base leading-7 text-on-surface-variant">
            The most useful support for Open Spot is local knowledge. Scoped curators keep the map honest — only for the countries and sports they can verify. Admins grant every scope.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={CURATOR_FORM_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 focus-visible:outline-offset-4"
            >
              Become a curator <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <a
              href="#curators"
              className="inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-outline-variant bg-surface-container-high px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-offset-4"
            >
              How it works
            </a>
          </div>
        </section>

        <aside className="self-start rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5 sm:p-6 lg:mb-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-sans text-xs font-semibold tracking-[0.05em] uppercase">How support flows</h2>
            <ShieldCheck size={18} strokeWidth={1.7} aria-hidden="true" className="text-secondary" />
          </div>
          <p className="mt-4 text-base leading-7 text-on-surface-variant">
            Sign in, fill the Google Form, get scoped. No payment — just verifiable local experience. Scopes are revocable and country/discipline-specific.
          </p>
          <div className="mt-5 rounded-[16px] border border-outline-variant bg-surface-container-low px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">Flow</p>
            <p className="mt-1 font-sans text-xs font-semibold leading-5 text-on-surface">
              Sign in → Fill form → Admin review in <span className="font-mono">/admin/users</span>
            </p>
          </div>
        </aside>
      </div>

      {/* Curators */}
      <section id="curators" className="mt-12 border-y border-outline-variant sm:mt-16" aria-labelledby="curators-title">
        <div className="flex items-end justify-between gap-6 border-b border-outline py-5">
          <div>
            <p className="font-sans text-xs font-semibold tracking-[0.05em] text-secondary uppercase">Community verification</p>
            <h2 id="curators-title" className="mt-1 font-display text-2xl font-bold uppercase leading-[1.3] tracking-[-0.02em] md:text-3xl">
              The map stays useful because riders curate it.
            </h2>
          </div>
          <span className="hidden font-sans text-xs font-semibold tracking-[0.05em] text-secondary sm:block">Curators 01—03</span>
        </div>

        <p className="max-w-2xl py-6 text-base leading-7 text-on-surface-variant">
          Curators are riders approved to maintain only what they know. Legacy &quot;curator&quot; bypasses scopes; new roles are scoped: spot and event curators by country, trick curators by discipline.
        </p>

        <div className="grid gap-4 pb-4 md:grid-cols-3">
          {curatorRoles.map(({ icon: Icon, title, kicker, body }) => (
            <article key={title} className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-surface-container-high text-on-surface">
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-surface-container-high px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">
                  {kicker}
                </span>
              </div>
              <h3 className="mt-8 font-display text-xl font-bold uppercase leading-[1.4] tracking-[-0.02em]">{title}</h3>
              <p className="mt-3 text-base leading-7 text-on-surface-variant">{body}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 border-t border-outline-variant py-4 md:grid-cols-3">
          {curatorSteps.map(({ step, title, body, action }) => {
            const ActionIcon = action.icon;
            const isExternal = "external" in action && action.external;
            return (
              <article key={step} className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold tracking-widest text-secondary">{step}</span>
                  <ActionIcon size={16} aria-hidden="true" className="text-secondary" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold uppercase leading-[1.3] tracking-[-0.02em]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">{body}</p>
                {"href" in action ? (
                  isExternal ? (
                    <a
                      href={action.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`mt-6 inline-flex min-h-11 items-center gap-2 rounded-[9999px] border px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] uppercase transition-colors focus-visible:outline-offset-4 ${
                        action.primary
                          ? "border-primary bg-primary text-on-primary hover:opacity-90"
                          : "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline hover:bg-surface-container-highest"
                      }`}
                    >
                      {action.label} <ActionIcon size={14} aria-hidden="true" />
                    </a>
                  ) : (
                    <Link
                      href={action.href}
                      className={`mt-6 inline-flex min-h-11 items-center gap-2 rounded-[9999px] border px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] uppercase transition-colors focus-visible:outline-offset-4 ${
                        action.primary
                          ? "border-primary bg-primary text-on-primary hover:opacity-90"
                          : "border-outline-variant bg-surface-container-high text-on-surface hover:border-outline hover:bg-surface-container-highest"
                      }`}
                    >
                      {action.label} <ActionIcon size={14} aria-hidden="true" />
                    </Link>
                  )
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="flex flex-wrap items-start gap-3 rounded-[16px] border border-outline-variant bg-surface-container-low p-4 text-sm leading-6 text-on-surface-variant">
          <ClipboardList size={16} aria-hidden="true" className="mt-1 shrink-0 text-on-surface" />
          <p>
            Admins review every assignment in <span className="font-mono text-xs font-semibold">/admin/users</span> — scopes live in{" "}
            <span className="font-mono text-xs">curator_country_scopes</span> and <span className="font-mono text-xs">curator_discipline_scopes</span>. No scope, no write.
          </p>
        </div>
      </section>

      {/* Coming soon — patron */}
      <section className="mt-12 border-y border-outline-variant sm:mt-16" aria-labelledby="coming-soon-title">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-outline py-5">
          <div>
            <p className="font-sans text-xs font-semibold tracking-[0.05em] text-secondary uppercase">Optional support</p>
            <h2 id="coming-soon-title" className="mt-1 font-display text-2xl font-bold uppercase leading-[1.3] tracking-[-0.02em] md:text-3xl">
              Coming soon
            </h2>
          </div>
          <span className="font-sans text-xs font-semibold tracking-[0.05em] text-secondary">02 up next</span>
        </div>
        <p className="max-w-2xl py-6 text-base leading-7 text-on-surface-variant">
          Monetary support is not open yet. When it is, it will be transparent and optional — the map will never be paywalled.
        </p>
        <div className="grid gap-4 pb-4 md:grid-cols-2">
          {comingSoon.map(({ title, body, icon: Icon }) => (
            <article
              key={title}
              className="rounded-[16px] border border-outline-variant bg-surface-container-low p-5 sm:p-6 text-on-surface-variant"
              aria-label={`${title}: coming soon`}
            >
              <div className="flex items-center justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-surface-container-high text-on-surface">
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="rounded-md bg-surface-container-high px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Coming soon
                </span>
              </div>
              <h3 className="mt-8 font-display text-xl font-bold uppercase leading-[1.4] tracking-[-0.02em] text-on-surface">{title}</h3>
              <p className="mt-3 text-base leading-7 text-on-surface-variant">{body}</p>
              <span className="mt-6 block font-sans text-xs font-semibold tracking-[0.05em] uppercase text-on-surface underline underline-offset-4">Coming soon</span>
            </article>
          ))}
        </div>
        <div className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5 sm:p-6">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">Transparency</p>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            When Buy me a coffee and Patreon open, this section will list clear use of funds — hosting, imagery, map costs. Until then the most valuable support is accurate curation.
          </p>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
        <Link
          href="/map"
          className="inline-flex min-h-11 items-center gap-2 rounded-[9999px] border border-primary bg-primary px-6 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 focus-visible:outline-offset-4"
        >
          Explore the map <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link
          href="/explore"
          className="inline-flex min-h-11 items-center rounded-[9999px] border border-outline-variant bg-surface-container-high px-5 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-offset-4"
        >
          See how it&apos;s curated
        </Link>
      </div>
    </main>
  );
}
