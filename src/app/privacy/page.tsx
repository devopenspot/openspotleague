import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { LegalLayout } from "@/components/legal/LegalLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import {
  PRIVACY_KEY_POINTS,
  PRIVACY_SECTIONS,
  PRIVACY_LAST_UPDATED,
  PRIVACY_VERSION,
  THIRD_PARTY_PROCESSORS,
} from "@/lib/legal/privacy-content";
import { env } from "@/lib/config/env";

const DESCRIPTION =
  "The OpenSpot Privacy Policy in plain words: what we collect, why, the services we use, and how to see or delete your data.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: DESCRIPTION,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy · Open Spot League",
    description: DESCRIPTION,
    url: `${env.APP_URL}/privacy`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy · Open Spot League",
    description: DESCRIPTION,
  },
};

function ServicesList() {
  return (
    <ul className="divide-y divide-outline-variant rounded-inner border border-outline-variant">
      {THIRD_PARTY_PROCESSORS.map((p) => (
        <li
          key={p.name}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
        >
          <div className="min-w-0">
            <p className="font-semibold text-on-surface">{p.name}</p>
            <p className="text-on-surface-variant">{p.purpose}</p>
          </div>
          <a
            href={p.privacyUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${p.name} privacy policy (opens in a new tab)`}
            className="inline-flex items-center gap-1 font-semibold text-primary underline decoration-outline hover:text-primary-focus focus-visible:outline-offset-2"
          >
            <span>Privacy policy</span>
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPage() {
  const toc = PRIVACY_SECTIONS.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Privacy Policy · Open Spot League",
    description: DESCRIPTION,
    url: `${env.APP_URL}/privacy`,
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
        title="Privacy Policy"
        kicker="Legal"
        lastUpdated={PRIVACY_LAST_UPDATED}
        version={PRIVACY_VERSION}
        keyPoints={PRIVACY_KEY_POINTS}
        tableOfContents={toc}
        activeDoc="privacy"
      >
        {PRIVACY_SECTIONS.map((section) => (
          <LegalSection key={section.id} section={section}>
            {section.id === "third-parties" ? <ServicesList /> : null}
          </LegalSection>
        ))}
      </LegalLayout>
    </>
  );
}
