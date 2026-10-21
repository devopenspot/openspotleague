import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { listSpotCards } from "@/lib/services/spot/spots";
import { listEvents } from "@/lib/services/event/events";
import { listTvCards } from "@/lib/services/tv/tv";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { Hero } from "@/components/landing/Hero";
import { LandingMetrics } from "@/components/landing/LandingMetrics";
import { LandingMarquee } from "@/components/landing/LandingMarquee";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { HomeSkeleton } from "@/components/landing/HomeSkeleton";
import { toMarqueeEvent, toMarqueeVideo } from "@/components/landing/marquee-data";

export const metadata: Metadata = {
  title: "Open Spot League",
  description: "Discover Spots & Track your Training",
};

const EMPTY_CARD_PAGE = {
  items: [] as const,
  nextCursor: null as string | null,
};
const EMPTY_EVENTS_PAGE = {
  items: [] as const,
  nextCursor: null as string | null,
  hasMore: false as const,
};
const EMPTY_TV_VIDEOS: readonly never[] = [];

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  const cookieStore = await cookies();
  const seed = cookieStore.get("osp_seed")?.value ?? crypto.randomUUID();

  const [marqueeSpotsPage, eventsPage, tvVideos] = await Promise.all([
    withSafeDefault(
      () => listSpotCards({ limit: 12, random: true, seed, hasImage: true }),
      EMPTY_CARD_PAGE as unknown as Awaited<ReturnType<typeof listSpotCards>>,
      "marqueeSpots-landing",
    ),
    withSafeDefault(
      () => listEvents({ limit: 12, random: true, seed }),
      EMPTY_EVENTS_PAGE as unknown as Awaited<ReturnType<typeof listEvents>>,
      "marqueeEvents-landing",
    ),
    withSafeDefault(
      () => listTvCards({ publishedOnly: true, limit: 12 }),
      EMPTY_TV_VIDEOS as unknown as Awaited<ReturnType<typeof listTvCards>>,
      "listTvCards-landing",
    ),
  ]);

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <Hero />
      <LandingMetrics />
      <LandingMarquee
        spots={marqueeSpotsPage.items}
        events={eventsPage.items.map(toMarqueeEvent)}
        videos={tvVideos.map(toMarqueeVideo)}
        initialSeed={seed}
        initialSpotsCursor={marqueeSpotsPage.nextCursor}
        initialEventsCursor={eventsPage.nextCursor}
      />
      <LandingFeatures />
      <LandingFooter />
    </div>
  );
}
