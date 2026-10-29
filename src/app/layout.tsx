import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Analytics } from "@vercel/analytics/next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils/cn";
import { env } from "@/lib/config/env";
import { getServerUserFromCookies } from "@/lib/auth/auth";
import { listRegions } from "@/lib/services/spot/regions";
import { listSpotTypes } from "@/lib/services/spot/spot-types";
import { listSavedSpotHeadsForUser } from "@/lib/services/spot/saved-spots";
import { listVerifiedSpotsForUser } from "@/lib/services/spot/verified-spots";
import { SpotsProvider } from "@/components/shell/SpotsProvider";
import {
  EMPTY_SAVED_SPOT_HEADS,
  EMPTY_VERIFIED_SPOTS,
  withSafeDefault,
} from "@/lib/utils/safe-fetch";
import type { Region, SpotTypeEntity } from "@/lib/types";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: "Open Spot League — Discover Spots & Track your Training",
    template: "%s · Open Spot",
  },
  description:
    "Is a directory and activity board for riders to maintain a consistent training routine and discover new spots to ride.",
  applicationName: "Open Spot League",
  keywords: [
    "skatepark",
    "skateparks",
    "skateboarding",
    "skateboard",
    "spots",
    "spot",
    "bike",
    "biker",
    "scooter",
    "roller",
    "rollerblade",
    "bladies",
    "contest",
    "imyta",
    "rollerblader",
    "DIY",
    "plaza",
    "bowl",
    "vert",
    "BMX",
  ],
  authors: [{ name: "Open Spot League" }],
  openGraph: {
    type: "website",
    siteName: "Open Spot League",
    title: "Discover Spots & Track your Training",
    description:
      "Is a directory and activity board for riders to maintain a consistent training routine and discover new spots to ride.",
    images: [
      {
        url: "/opengraph.png",
        width: 1200,
        height: 630,
        alt: "OpenSpot League",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Open Spot League",
    description: "Discover Spots & Track your Training.",
    images: ["/opengraph.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(jakarta.variable)} suppressHydrationWarning>
      <body className="bg-background font-sans text-on-background antialiased">
        <Suspense fallback={<div className="min-h-screen bg-background" aria-hidden="true" />}>
          <RootDataProviders>{children}</RootDataProviders>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}

async function RootDataProviders({ children }: { children: React.ReactNode }) {
  await connection();
  // The root layout hydrates only the uncapped catalogs (regions with
  // server-truth country counts, spot types) plus auth/saved/verified
  // state. Spot rows are a MAP-ONLY working set: the map route's
  // layout hydrates them. Public pages must not filter spot features
  // against a capped, page-loaded snapshot — filters that need DB
  // truth fetch it server-side (suggested spots, explore counts) or
  // through the public API (search overlay text search).
  //
  // Weather is intentionally NOT fetched here. The previous design
  // called `getWeatherForAllSpots(initialSpots)` from the SSR
  // critical path, which fanned out one OpenWeather call per spot
  // (~200 seeded) and waited behind the in-process 50 req/min
  // token bucket, making a cold-cache first render take several
  // minutes. Now `SpotsProvider` starts with an empty weather map;
  // each consumer (the home spotlight grid, the map markers, the
  // spot detail page) calls `useSpotWeather` / `useSpotsWeather`
  // on the client and asks `/api/weather` for exactly the spots it
  // displays. The per-spot `"use cache"` boundary in
  // `lib/weather/weather-cached.ts` still absorbs >99% of calls in
  // steady state.
  //
  // Each fan-out thunk is wrapped in `withSafeDefault` so a single
  // DB call failing (bad env, paused project, network partition)
  // cannot crash the whole page — see AGENTS.md "anonymous browsing
  // renders empty fallbacks instead of 500s."
  const EMPTY_REGIONS: readonly Region[] = [];
  const EMPTY_SPOT_TYPES: readonly SpotTypeEntity[] = [];
  const [initialRegions, initialSpotTypes, initialUser] = await Promise.all([
    withSafeDefault(() => listRegions(), EMPTY_REGIONS, "listRegions"),
    withSafeDefault(() => listSpotTypes(), EMPTY_SPOT_TYPES, "listSpotTypes"),
    withSafeDefault(
      () => getServerUserFromCookies(),
      null,
      "getServerUserFromCookies",
    ),
  ]);
  const [savedSpotsResult, verifiedSpotsResult] = await Promise.all([
    initialUser
      ? withSafeDefault(
          () => listSavedSpotHeadsForUser(initialUser.id, { limit: 200 }),
          EMPTY_SAVED_SPOT_HEADS,
          "listSavedSpotHeadsForUser",
        )
      : Promise.resolve(EMPTY_SAVED_SPOT_HEADS),
    initialUser
      ? withSafeDefault(
          () => listVerifiedSpotsForUser(initialUser.id, { limit: 200 }),
          EMPTY_VERIFIED_SPOTS,
          "listVerifiedSpotsForUser",
        )
      : Promise.resolve(EMPTY_VERIFIED_SPOTS),
  ]);
  const initialSavedSpots = savedSpotsResult.items;
  const initialVerifiedSpots = verifiedSpotsResult.items;
  return (
    <SpotsProvider
      initialRegions={initialRegions}
      initialSpotTypes={initialSpotTypes}
      initialWeather={{}}
      initialUser={initialUser}
      initialSavedSpots={initialSavedSpots}
      initialVerifiedSpots={initialVerifiedSpots}
    >
      {children}
    </SpotsProvider>
  );
}
