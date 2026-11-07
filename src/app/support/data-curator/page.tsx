import type { Metadata } from "next";
import Link from "next/link";
import countriesRaw from "@/data/countries.json";
import { DataCuratorForm } from "@/components/support/DataCuratorForm";
import type { CountryOption } from "@/components/support/DataCuratorForm";
import { EYEBROW_ON_WASH, PAGE_TITLE, controlClass } from "@/components/ui/recipes";
import { OG_IMAGES, ogImage } from "@/lib/og/config";

const CURATOR_DESCRIPTION =
  "Apply to become a scoped data curator for spots, TV videos or tricks on Open Spot.";

export const metadata: Metadata = {
  title: "Become a data curator",
  description: CURATOR_DESCRIPTION,
  robots: { index: false, follow: false },
  // noindex keeps it out of search; link unfurls still read OpenGraph.
  openGraph: {
    type: "website",
    title: "Become a data curator",
    description: CURATOR_DESCRIPTION,
    images: [ogImage(OG_IMAGES.curator, "Become a data curator on Open Spot")],
  },
  twitter: {
    card: "summary_large_image",
    title: "Become a data curator",
    description: CURATOR_DESCRIPTION,
    images: [OG_IMAGES.curator],
  },
};

// Project to the two fields the client renders (RSC wire slimming).
const countries: CountryOption[] = (
  countriesRaw as { iso2: string; name: string }[]
)
  .map(({ iso2, name }) => ({ iso2, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function DataCuratorApplicationPage() {
  return (
    <div className="min-h-full w-full bg-gradient-support text-on-surface">
      <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-10 md:py-10">
        <Link
          href="/support"
          className={controlClass("onWash", "sm")}
        >
          Back to support
        </Link>
        <p className={`mt-6 ${EYEBROW_ON_WASH}`}>
          Data curator application
        </p>
        <h1 className={`mt-2 ${PAGE_TITLE} md:text-5xl`}>
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
    </div>
  );
}
