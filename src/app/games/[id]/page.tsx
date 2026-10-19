import type { Metadata } from "next";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { GameBoard } from "@/components/games/board/GameBoard";
import { getGameOgPreviewById } from "@/lib/services/games";
import { findSpotById } from "@/lib/services/spot/spots";
import { getSpotWeather } from "@/lib/weather/weather-cached";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import {
  buildGameDescription,
  buildGameTitle,
  buildWeatherLabel,
  formatGameDate,
} from "@/lib/og/formatters";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await connection();
  const { id } = await params;
  const preview = await withSafeDefault(
    () => getGameOgPreviewById(id),
    null,
    "getGameOgPreviewById",
  );

  if (!preview) {
    return {
      title: "Game unavailable",
      openGraph: {
        images: [
          {
            url: "/opengrapgh.png",
            width: 1200,
            height: 630,
            alt: "OpenSpot League",
          },
        ],
      },
    };
  }

  const spotName = preview.spot?.name ?? preview.removedSpot?.name ?? null;
  const dateLabel = formatGameDate({
    scheduledStartAt: preview.scheduledStartAt,
    createdAt: preview.createdAt,
    timezone: preview.timezone,
  });

  let weatherLabel: string | null = null;
  if (preview.weather?.forecastIcon || preview.weather?.observedIcon) {
    const icon =
      preview.weather.forecastIcon ?? preview.weather.observedIcon ?? null;
    weatherLabel = buildWeatherLabel({
      icon,
      description: preview.weather.forecastDescription,
      temp: preview.weather.forecastTemp,
    });
    // If stored weather has no temp but spot exists, try live weather
    if (!weatherLabel && preview.spot) {
      const spot = await withSafeDefault(
        () => findSpotById(preview.spot!.id),
        null,
        "findSpotById(og)",
      );
      if (spot) {
        const live = await withSafeDefault(
          () =>
            getSpotWeather({
              spotId: spot.id,
              latitude: spot.location.lat,
              longitude: spot.location.lon,
            }),
          null,
          "getSpotWeather(game og)",
        );
        if (live)
          weatherLabel = buildWeatherLabel({
            icon: live.icon,
            description: live.description,
            temp: live.current,
          });
      }
    }
  } else if (preview.spot) {
    const spot = await withSafeDefault(
      () => findSpotById(preview.spot!.id),
      null,
      "findSpotById(og)",
    );
    if (spot) {
      const live = await withSafeDefault(
        () =>
          getSpotWeather({
            spotId: spot.id,
            latitude: spot.location.lat,
            longitude: spot.location.lon,
          }),
        null,
        "getSpotWeather(game og)",
      );
      if (live)
        weatherLabel = buildWeatherLabel({
          icon: live.icon,
          description: live.description,
          temp: live.current,
        });
    }
  }

  const title = buildGameTitle({
    mode: preview.mode,
    gameName: preview.gameName,
    host: preview.creatorDisplayName,
  });
  const description = buildGameDescription({
    mode: preview.mode,
    spotName,
    dateLabel,
    weatherLabel,
    host: preview.creatorDisplayName,
  });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `/games/${encodeURIComponent(id)}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/games/${encodeURIComponent(id)}/opengraph-image`],
    },
  };
}

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const [{ id }, { share }, user] = await Promise.all([
    params,
    searchParams,
    getSessionUser(),
  ]);
  return <GameBoard gameId={id} userId={user?.id ?? null} shareCode={share} />;
}
