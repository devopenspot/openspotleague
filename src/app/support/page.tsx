import Link from "next/link";
import { ArrowUpRight, Heart, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { getPaypalSupportUrl } from "@/lib/config/env";
import { Eyebrow } from "@/components/ui/Eyebrow";
import {
  CARD,
  CARD_TITLE,
  EYEBROW,
  EYEBROW_ON_WASH,
  PAGE_TITLE,
  controlClass,
  tagClass,
} from "@/components/ui/recipes";

// Process to be a data curator: sign in → fill form → admin review → scoped role.

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

const primaryBtn = controlClass("primary");
const secondaryBtn = controlClass("onWash");

export default function SupportPage() {
  const paypalUrl = getPaypalSupportUrl();

  return (
    <div className="min-h-full w-full bg-gradient-support text-on-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-8 md:px-10 md:py-10 lg:min-h-[calc(100dvh-var(--app-header-h))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10">
        <section>
          <Link
            href="/"
            className={controlClass("onWash", "sm")}
          >
            Back to the map
          </Link>
          <p className={`mt-6 lg:mt-8 ${EYEBROW_ON_WASH}`}>
            Open directory — curated by riders
          </p>
          <h1 className={`mt-2 max-w-xl ${PAGE_TITLE} md:text-5xl`}>
            Support through data curation.
          </h1>
          <p className="mt-4 max-w-md text-base leading-7">
            The most useful support for Open Spot is local knowledge. Scoped
            data curators keep the map honest — only for the countries and
            sports they can verify.
          </p>
          <ol
            className="mt-5 flex flex-wrap gap-x-4 gap-y-1"
            aria-label="How to become a data curator"
          >
            {steps.map((s) => (
              <li key={s}>
                <Eyebrow className="text-on-surface">{s}</Eyebrow>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/support/data-curator" className={primaryBtn}>
              Become a data curator{" "}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
            <a
              href={paypalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Support Open Spot via PayPal (opens in a new tab)"
              className={secondaryBtn}
            >
              Support via PayPal <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </section>

        <div className="grid gap-4 mb-16">
          <section
            id="guidelines"
            aria-labelledby="guidelines-title"
            className={CARD}
          >
            <div className="flex items-center justify-between gap-3">
              <h2
                id="guidelines-title"
                className={EYEBROW}
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
                  className={tagClass("neutral")}
                >
                  {scope}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="support-options-title"
            className={CARD}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-control w-control items-center justify-center rounded-full bg-surface-container-high text-on-surface">
                  <Heart size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <h2
                  id="support-options-title"
                  className={CARD_TITLE}
                >
                  PayPal
                </h2>
              </div>
              <span className={tagClass("solid")}>
                Live
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-sm">
                <p className="text-sm leading-5 text-on-surface-variant">
                  One-off support for hosting, imagery and map costs. The map
                  stays open.
                </p>
                <div className="mt-4">
                  <a
                    href={paypalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Donate via PayPal (opens in a new tab)"
                    className={primaryBtn}
                  >
                    Donate via PayPal{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </a>
                </div>
              </div>
              <div
                role="img"
                aria-label="QR code to support Open Spot via PayPal"
                className="hidden shrink-0 rounded-inner border border-outline-variant bg-surface-container-lowest p-2.5 sm:block"
              >
                <QRCodeSVG
                  value={paypalUrl}
                  size={88}
                  bgColor="#ffffff"
                  fgColor="#0a0a0a"
                  level="M"
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
