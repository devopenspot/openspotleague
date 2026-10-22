import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import {
  TERMS_SECTIONS,
  TERMS_EFFECTIVE_DATE,
  TERMS_LAST_UPDATED,
  TERMS_VERSION,
} from "@/lib/legal/terms-content";
import { env } from "@/lib/config/env";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "Official Terms of Use for Open Spot League: rider responsibility, extreme sports liability waiver, anti-trespassing policies, and challenge network rules.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Use · Open Spot League",
    description:
      "Official Terms of Use for Open Spot League: rider responsibility, extreme sports liability waiver, anti-trespassing policies, and challenge network rules.",
    url: `${env.APP_URL}/terms`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Terms of Use · Open Spot League",
    description:
      "Official Terms of Use for Open Spot League: rider responsibility, extreme sports liability waiver, anti-trespassing policies, and challenge network rules.",
  },
};

export default function TermsPage() {
  const toc = TERMS_SECTIONS.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms of Use · Open Spot League",
    description:
      "Official Terms of Use for Open Spot League covering rider responsibility, physical waivers, and spot directory rules.",
    url: `${env.APP_URL}/terms`,
    datePublished: "2026-10-21",
    dateModified: "2026-10-21",
    publisher: {
      "@type": "Organization",
      name: "Open Spot League",
      url: env.APP_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LegalLayout
        title="Terms of Use"
        kicker="Legal & Compliance"
        effectiveDate={TERMS_EFFECTIVE_DATE}
        lastUpdated={TERMS_LAST_UPDATED}
        version={TERMS_VERSION}
        tableOfContents={toc}
        activeDoc="terms"
      >
        {TERMS_SECTIONS.map((section) => (
          <LegalSection key={section.id} section={section} />
        ))}
      </LegalLayout>
    </>
  );
}
