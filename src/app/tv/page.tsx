import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { findTvCardById, listTvCategoryRows } from "@/lib/services/tv/tv";
import { listSports } from "@/lib/services/taxonomy/taxonomy";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { env } from "@/lib/config/env";
import { TV_OG_IMAGE_PATH, buildTvShareDescription, resolveTvOgImage } from "@/lib/tv/share";
import { resolveDisciplineParam } from "@/components/tv/marquee/tv-marquee-data";
import { TvGrid } from "@/components/tv/grid/TvGrid";
import TvLoading from "./loading";

const TV_TITLE = "TV — Open Spot";
const TV_DESCRIPTION =
  "Curated YouTube videos classified by discipline. Watch profile, event, music and more — embeddable anywhere.";

type TvSearchParams = {
  discipline?: string | string[];
  play?: string | string[];
  v?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function tvBaseMetadata(ogImage: string): Metadata {
  return {
    title: TV_TITLE,
    description: TV_DESCRIPTION,
    openGraph: {
      title: TV_TITLE,
      description: TV_DESCRIPTION,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "OpenSpot TV",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TV_TITLE,
      description: TV_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<TvSearchParams>;
}): Promise<Metadata> {
  await connection();
  // Absolute https URL — link-unfurl crawlers fetch `og:image` without
  // running JS, so a relative path never resolves outside page context.
  const ogImage = new URL(TV_OG_IMAGE_PATH, env.APP_URL).toString();
  const resolved = await searchParams;
  const playId = firstParam(resolved.play) ?? firstParam(resolved.v) ?? null;
  if (!playId) return tvBaseMetadata(ogImage);

  const video = await withSafeDefault(
    () => findTvCardById(playId),
    null,
    "findTvCardById-tv-og",
  );
  // Unpublished/unknown/DB-down: generic TV card, never a 500.
  if (!video) return tvBaseMetadata(ogImage);

  const description = buildTvShareDescription(video);
  const ogMedia = resolveTvOgImage(video, ogImage);
  return {
    title: video.title,
    description,
    openGraph: {
      title: video.title,
      description,
      type: "website",
      images: [
        {
          url: ogMedia.url,
          width: ogMedia.width,
          height: ogMedia.height,
          alt: ogMedia.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [ogMedia.url],
    },
  };
}

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<TvSearchParams>;
}) {
  await connection();
  const [resolved, disciplines] = await Promise.all([
    searchParams,
    withSafeDefault(
      () => listSports(),
      [] as Awaited<ReturnType<typeof listSports>>,
      "listSports-tv",
    ),
  ]);
  const rawParam = firstParam(resolved.discipline);
  const playId = firstParam(resolved.play) ?? firstParam(resolved.v) ?? null;

  // disciplines may be objects with slug/name or just slugs — normalize
  const normalized = (
    disciplines as readonly { slug: string; name: string }[]
  ).map((d) => ({
    slug: d.slug,
    name: d.name ?? d.slug,
  }));

  // URL is the source of truth: a valid ?discipline= filters server-side
  // (one shared cache entry per discipline). Otherwise initial load renders
  // all sports / default catalog, and client smoothly activates preference.
  const urlDiscipline = resolveDisciplineParam(
    rawParam,
    normalized.map((d) => d.slug),
  );

  const isExplicitAll = rawParam?.trim().toLowerCase() === "all";
  const initialDiscipline = isExplicitAll
    ? "all"
    : (urlDiscipline ?? null);
  const effectiveDiscipline =
    initialDiscipline === "all" ? undefined : (initialDiscipline ?? undefined);

  const [rows, initialPlayVideo] = await Promise.all([
    withSafeDefault(
      () => listTvCategoryRows(effectiveDiscipline),
      [] as Awaited<ReturnType<typeof listTvCategoryRows>>,
      "listTvCategoryRows-tv",
    ),
    playId
      ? withSafeDefault(
          () => findTvCardById(playId),
          null,
          "findTvCardById-tv-initialPlay",
        )
      : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-dvh bg-black">
      <div className="mx-auto max-w-6xl px-0 py-2 md:py-8">
        <Suspense fallback={<TvLoading />}>
          <TvGrid
            rows={rows}
            disciplines={normalized}
            initialDiscipline={initialDiscipline}
            initialPlayVideo={initialPlayVideo}
          />
        </Suspense>
      </div>
    </div>
  );
}
