import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import {
  TERMS_KEY_POINTS,
  TERMS_SECTIONS,
  TERMS_LAST_UPDATED,
  TERMS_VERSION,
} from "@/lib/legal/terms-content";
import { env } from "@/lib/config/env";

const DESCRIPTION =
  "The OpenSpot Terms of Use in plain words: ride at your own risk, respect private property, own what you post, and play fair.";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: DESCRIPTION,
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Use · Open Spot League",
    description: DESCRIPTION,
    url: `${env.APP_URL}/terms`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Terms of Use · Open Spot League",
    description: DESCRIPTION,
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
    description: DESCRIPTION,
    url: `${env.APP_URL}/terms`,
    datePublished: "2026-10-21",
    dateModified: "2026-11-07",
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
        kicker="Legal"
        lastUpdated={TERMS_LAST_UPDATED}
        version={TERMS_VERSION}
        keyPoints={TERMS_KEY_POINTS}
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
