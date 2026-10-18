import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { GameDomainError } from "@/lib/games/definitions";
import {
  getGameOgPreviewByShareCode,
  resolveGameIdByShareCode,
} from "@/lib/services/games";
import { findSpotById } from "@/lib/services/spot/spots";
import { getSpotWeather } from "@/lib/weather/weather-cached";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import {
  buildGameDescription,
  buildGameTitle,
  buildWeatherLabel,
  formatGameDate,
} from "@/lib/og/formatters";
import { isSocialCrawler } from "@/lib/og/crawler";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}): Promise<Metadata> {
  await connection();
  const { shareCode: raw } = await params;
  const shareCode = decodeURIComponent(raw);
  const preview = await withSafeDefault(
    () => getGameOgPreviewByShareCode(shareCode),
    null,
    "getGameOgPreviewByShareCode",
  );
  if (!preview) {
    return {
      title: "Invite not found",
      description: "This Open Spot invite could not be found.",
      openGraph: {
        title: "Invite not found",
        description: "This Open Spot invite could not be found.",
        images: [
          {
            url: "/opengrapgh.png",
            width: 1200,
            height: 630,
            alt: "OpenSpot League",
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        images: ["/opengrapgh.png"],
      },
    };
  }

  const spotName = preview.spot?.name ?? null;
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
  }
  if (!weatherLabel && preview.spot) {
    const spot = await withSafeDefault(
      () => findSpotById(preview.spot!.id),
      null,
      "findSpotById(join og)",
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
        "getSpotWeather(join og)",
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

  const encoded = encodeURIComponent(shareCode);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: `/games/join/${encoded}/opengraph-image`,
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
      images: [`/games/join/${encoded}/opengraph-image`],
    },
  };
}

export default async function JoinGamePage({
  params,
}: {
  params: Promise<{ shareCode: string }>;
}) {
  let isCrawler: boolean;
  try {
    const headersList = await headers();
    const userAgent = headersList.get("user-agent");
    isCrawler = isSocialCrawler(userAgent);
  } catch {
    isCrawler = false;
  }

  const user = await getSessionUser();
  const { shareCode } = await params;
  let game: { id: string; mode: string };
  try {
    game = await resolveGameIdByShareCode(shareCode);
  } catch (error) {
    if (error instanceof GameDomainError)
      redirect("/games?error=game-not-found");
    redirect("/games?error=game-unavailable");
  }
  const nextPath = `/games/${game.id}?share=${encodeURIComponent(shareCode)}`;
  // For social crawlers (WhatsApp, Facebook, etc.) render a 200 preview instead of redirecting,
  // otherwise WhatsApp never sees the og:image. Humans still get the redirect.
  if (isCrawler) {
    const preview = await withSafeDefault(
      () => getGameOgPreviewByShareCode(shareCode),
      null,
      "getGameOgPreviewByShareCode(crawler)",
    );
    return (
      <CrawlerPreview
        preview={preview}
        nextPath={nextPath}
        shareCode={shareCode}
      />
    );
  }

  if (!user && game.mode !== "training") {
    return <ChallengeSignInGate nextPath={nextPath} />;
  }
  redirect(nextPath);
}

function ChallengeSignInGate({ nextPath }: { nextPath: string }) {
  const signInUrl = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="min-h-full px-5 py-8 sm:px-8 sm:py-12 lg:px-10 lg:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Challenge invite
          </p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-bold uppercase leading-[1.05] tracking-[-0.03em] text-on-surface sm:text-6xl">
            Sign in to ride
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-on-surface-variant sm:text-base">
            This challenge is ready for you. Sign in to join the lobby and keep
            your rider progress connected to your Open Spot account.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={signInUrl}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-display text-xs font-bold uppercase tracking-[0.06em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
            >
              Sign in to join
            </Link>
            <Link
              href="/games"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-bold uppercase tracking-[0.06em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
            >
              Explore games
            </Link>
          </div>
        </section>

        <div className="relative min-h-[18rem] overflow-hidden bg-on-surface sm:min-h-[24rem] lg:min-h-full">
          <Image
            src="/challenges.jpg"
            alt="Open Spot training and challenges"
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-contain p-8 sm:p-12"
            priority
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-on-surface/80 to-transparent px-5 pb-5 pt-16">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-surface/80">
              Open Spot / Group play
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrawlerPreview({
  preview,
  nextPath,
  shareCode,
}: {
  preview: Awaited<ReturnType<typeof getGameOgPreviewByShareCode>>;
  nextPath: string;
  shareCode: string;
}) {
  if (!preview) {
    return (
      <div className="min-h-full px-5 py-12 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-secondary">
          Invite not found
        </p>
        <Link
          href="/games"
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-xs font-bold uppercase tracking-widest text-on-primary"
        >
          Explore games
        </Link>
      </div>
    );
  }
  const isChallenge = preview.mode === "challenge";
  const badge = isChallenge ? "Challenge Invite" : "Training Invite";
  const imageSrc = isChallenge ? "/challenges.jpg" : "/trainings.jpg";
  return (
    <div className="min-h-full px-5 py-8 sm:px-8 sm:py-12 lg:px-10 lg:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
        <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-14">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            {badge}
          </p>
          <h1 className="mt-3 max-w-xl font-display text-4xl font-bold uppercase leading-[1.05] tracking-[-0.03em] text-on-surface sm:text-6xl">
            {preview.gameName}
          </h1>
          <p className="mt-3 font-display text-xs font-bold uppercase tracking-[0.06em] text-on-surface-variant">
            Hosted by {preview.creatorDisplayName}
            {preview.spot
              ? ` · @ ${preview.spot.name}`
              : preview.removedSpot
                ? ` · @ ${preview.removedSpot.name} (removed)`
                : ""}
          </p>
          <p className="mt-4 text-sm leading-6 text-on-surface-variant">
            {isChallenge
              ? "A crew is gathering at a registered spot."
              : "An open training session."}{" "}
            Join the lobby to ride together.
          </p>
          <div className="mt-6 rounded-[12px] border border-outline-variant bg-surface-container-high px-4 py-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary">
              Share code
            </p>
            <p className="mt-1 font-mono text-sm font-bold tracking-[0.14em]">
              {shareCode}
            </p>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={nextPath}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 font-display text-xs font-bold uppercase tracking-[0.06em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
            >
              Open lobby
            </Link>
            <Link
              href="/games"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-bold uppercase tracking-[0.06em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
            >
              Explore games
            </Link>
          </div>
        </section>
        <div className="relative min-h-[18rem] overflow-hidden bg-on-surface sm:min-h-[24rem] lg:min-h-full">
          <Image
            src={imageSrc}
            alt={isChallenge ? "Challenge" : "Training"}
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-contain p-8 sm:p-12"
            priority
          />
        </div>
      </div>
    </div>
  );
}
