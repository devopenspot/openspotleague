import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { getPreferences } from "@/lib/services/profile/preferences";
import { findTvCardById, listTvCategoryRows } from "@/lib/services/tv/tv";
import { listSports } from "@/lib/services/taxonomy/taxonomy";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { env } from "@/lib/config/env";
import { TV_OG_IMAGE_PATH, buildTvShareDescription } from "@/lib/tv/share";
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
  return {
    title: video.title,
    description,
    openGraph: {
      title: video.title,
      description,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: video.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: video.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function TvPage({
  searchParams,
}: {
  searchParams: Promise<TvSearchParams>;
}) {
  await connection();
  const resolved = await searchParams;
  const rawParam = firstParam(resolved.discipline);
  const playId = firstParam(resolved.play) ?? firstParam(resolved.v) ?? null;

  const disciplines = await withSafeDefault(
    () => listSports(),
    [] as Awaited<ReturnType<typeof listSports>>,
    "listSports-tv",
  );

  // disciplines may be objects with slug/name or just slugs — normalize
  const normalized = (
    disciplines as readonly { slug: string; name: string }[]
  ).map((d) => ({
    slug: d.slug,
    name: d.name ?? d.slug,
  }));

  // URL is the source of truth: a valid ?discipline= filters server-side
  // (one shared cache entry per discipline). Otherwise fall back to the
  // signed-in preference, else unfiltered. The effective discipline drives
  // BOTH the rows query and initialDiscipline so the pill and grid agree
  // on first paint.
  const urlDiscipline = resolveDisciplineParam(
    rawParam,
    normalized.map((d) => d.slug),
  );

  const isExplicitAll = rawParam?.trim().toLowerCase() === "all";

  let prefDiscipline: string | null = null;
  if (!urlDiscipline && !isExplicitAll) {
    const sessionUser = await withSafeDefault(
      () => getSessionUser(),
      null as Awaited<ReturnType<typeof getSessionUser>>,
      "getSessionUser-tv",
    );
    if (sessionUser) {
      const prefs = await withSafeDefault(
        () => getPreferences(sessionUser.id),
        null as Awaited<ReturnType<typeof getPreferences>> | null,
        "getPreferences-tv",
      );
      const slug = prefs?.disciplineSlug?.toLowerCase() ?? null;
      if (slug && normalized.some((d) => d.slug.toLowerCase() === slug)) {
        prefDiscipline = slug;
      }
    }
  }

  const initialDiscipline = isExplicitAll
    ? "all"
    : (urlDiscipline ?? prefDiscipline ?? null);
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
