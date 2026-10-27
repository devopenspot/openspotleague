import Link from "next/link";
import countriesRaw from "@/data/countries.json";
import { DataCuratorForm } from "@/components/support/DataCuratorForm";
import type { CountryOption } from "@/components/support/DataCuratorForm";

export const metadata = {
  title: "Become a data curator",
  description:
    "Apply to become a scoped data curator for spots, TV videos or tricks on Open Spot.",
  robots: { index: false, follow: false },
};

// Project to the two fields the client renders (RSC wire slimming).
const countries: CountryOption[] = (
  countriesRaw as { iso2: string; name: string }[]
)
  .map(({ iso2, name }) => ({ iso2, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function DataCuratorApplicationPage() {
  return (
    <main className="min-h-[calc(100dvh-4rem)] w-full bg-gradient-explore text-primary">
      <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:py-8 md:px-10 md:py-10">
        <Link
          href="/support"
          className="inline-flex min-h-9 items-center rounded-full border border-primary/30 bg-surface-container-lowest px-4 py-2 font-sans text-xs font-semibold tracking-[0.05em] uppercase transition-colors hover:border-primary focus-visible:outline-offset-4"
        >
          Back to support
        </Link>
        <p className="mt-6 font-sans text-xs font-semibold tracking-[0.05em] uppercase">
          Data curator application
        </p>
        <h1 className="mt-2 font-display text-[32px] font-bold uppercase leading-[1.15] tracking-[-0.02em] md:text-5xl">
          Apply to be a data curator.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7">
          Tell us what you can verify. Admins review every application and grant
          scopes — see the{" "}
          <Link
            href="/support#guidelines"
            className="font-semibold underline underline-offset-4"
          >
            guidelines
          </Link>
          .
        </p>
        <div className="mt-6 mb-16">
          <DataCuratorForm countries={countries} />
        </div>
      </div>
    </main>
  );
}
