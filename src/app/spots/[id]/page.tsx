import { connection } from "next/server";
import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { findSpotById } from "@/lib/services/spot/spots";
import { listSuggestedSpots } from "@/lib/services/spot/suggested";
import { getSpotWeather } from "@/lib/weather/weather-cached";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { env } from "@/lib/config/env";
import { DEFAULT_OG_IMAGE_PATH } from "@/lib/og/config";
import { isHttpImageUrl } from "@/lib/og/images";
import type { Spot } from "@/lib/types";
import { SpotDetailsFullPage } from "@/components/spots/detail/SpotDetailsFullPage";
import { buildWeatherLabel, formatOgDate, truncate } from "@/lib/og/formatters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const spot = await withSafeDefault(
    () => findSpotById(id),
    null,
    "findSpotById",
  );
  if (!spot) {
    // WhatsApp-style crawlers need an absolute https URL — a relative
    // "/opengraph.png" never resolves outside the page context.
    const fallback = new URL(DEFAULT_OG_IMAGE_PATH, env.APP_URL).toString();
    return {
      title: "Spot unavailable",
      openGraph: {
        images: [
          {
            url: fallback,
            width: 1200,
            height: 630,
            alt: "OpenSpot League",
          },
        ],
      },
    };
  }
  const typeList = spot.types.map((t) => t.name).join(", ");
  const dateLabel = formatOgDate(new Date());
  let weather: Awaited<ReturnType<typeof getSpotWeather>> | null = null;
  if (
    spot.location &&
    typeof spot.location.lat === "number" &&
    typeof spot.location.lon === "number"
  ) {
    weather = await withSafeDefault(
      () =>
        getSpotWeather({
          spotId: spot.id,
          latitude: spot.location.lat,
          longitude: spot.location.lon,
        }),
      null,
      "getSpotWeather(og)",
    );
  }
  const weatherLabel = weather
    ? buildWeatherLabel({
        icon: weather.icon,
        description: weather.description,
        temp: weather.current,
      })
    : null;
  const locationLabel = [spot.city, spot.country].filter(Boolean).join(", ");
  const description = truncate(
    [typeList, locationLabel, dateLabel, weatherLabel]
      .filter(Boolean)
      .join(" · "),
    200,
  );
  // Direct spot photo for link unfurls (WhatsApp/Facebook fetch `og:image`
  // without running JS): an absolute http(s) URL when the spot has one,
  // otherwise the absolute default asset. The dynamic
  // `/spots/:id/opengraph-image` route stays as a hardened secondary.
  const ogImageUrl = isHttpImageUrl(spot.image)
    ? spot.image
    : new URL(DEFAULT_OG_IMAGE_PATH, env.APP_URL).toString();
  return {
    title: spot.name,
    description,
    openGraph: {
      title: spot.name,
      description,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: spot.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: spot.name,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const spot = await withSafeDefault(
    () => findSpotById(id),
    null,
    "findSpotById",
  );
  if (!spot) {
    return <SpotUnavailableFallback />;
  }
  // Server-fetched suggestion pool (PostGIS nearby) replaces the
  // capped client-directory pool — the client still re-ranks by the
  // user's live location when granted.
  const EMPTY_POOL: readonly Spot[] = [];
  const hasFiniteCoords =
    Number.isFinite(spot.location.lat) && Number.isFinite(spot.location.lon);
  const suggestedPool = hasFiniteCoords
    ? await withSafeDefault(
        () =>
          listSuggestedSpots({
            spotId: spot.id,
            lat: spot.location.lat,
            lon: spot.location.lon,
          }),
        EMPTY_POOL,
        "listSuggestedSpots",
      )
    : EMPTY_POOL;
  return <SpotDetailsFullPage spot={spot} suggestedPool={suggestedPool} />;
}

function SpotUnavailableFallback() {
  return (
    <div
      role="alert"
      className="min-h-[60vh] flex items-center justify-center p-6"
    >
      <div className="mx-auto my-12 max-w-md rounded-lg border border-outline-variant bg-surface-bright p-6 text-center sm:p-8">
        <span className="font-display text-xs font-semibold tracking-[0.05em] text-secondary uppercase block mb-3">
          503 · Off the grid
        </span>
        <h1 className="font-display text-3xl font-bold uppercase leading-[1.15] tracking-[-0.02em] text-on-surface">
          Spot temporarily unavailable
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-5 text-on-surface-variant">
          We can&rsquo;t reach the spot right now. Try again in a moment.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center space-x-2 rounded-lg border-2 border-primary bg-primary px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px"
        >
          <Compass size={14} aria-hidden="true" />
          <span>Back to directory</span>
        </Link>
      </div>
    </div>
  );
}
