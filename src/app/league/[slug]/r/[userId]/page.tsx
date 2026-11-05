import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Medal } from "lucide-react";
import { LeagueWash } from "@/components/league/landing/LeagueWash";
import { ShareActions } from "@/components/ui/ShareActions";
import { BODY, CARD, EYEBROW, LABEL, TILE, controlClass, pageContainer } from "@/components/ui/recipes";
import { getSessionUser } from "@/lib/auth/server";
import { buildContestDetailUrl, buildContestResultUrl } from "@/lib/league/urls";
import { getRiderResultCard } from "@/lib/services/league/result-card";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

async function load(slug: string, userId: string) {
  const viewer = await getSessionUser();
  return withSafeDefault(() => getRiderResultCard(slug, userId, viewer?.id ?? null), null, "getRiderResultCard");
}

function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[rank % 10] ?? "th"}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}): Promise<Metadata> {
  await connection();
  const { slug, userId } = await params;
  const card = await load(slug, userId);
  if (!card) return { title: "Result unavailable", robots: { index: false, follow: false } };
  const best = [...card.results].sort((a, b) => a.rank - b.rank)[0]!;
  const title = `${card.rider.name} · ${ordinal(best.rank)} in ${best.label}`;
  const description = `${card.contest.name} · ${card.contest.dateRangeLabel}`;
  if (card.contest.visibility !== "public") {
    return { title, description, robots: { index: false, follow: false } };
  }
  const image = `${buildContestResultUrl(slug, userId)}/opengraph-image`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website", images: [{ url: image, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function RiderResultPage({
  params,
}: {
  params: Promise<{ slug: string; userId: string }>;
}) {
  await connection();
  const { slug, userId } = await params;
  const card = await load(slug, userId);
  if (!card) notFound();
  const url = buildContestResultUrl(slug, userId);
  const best = [...card.results].sort((a, b) => a.rank - b.rank)[0]!;

  return (
    <LeagueWash>
      <div className={pageContainer("3xl")}>
        <nav aria-label="Breadcrumb" className="mb-6">
          <Link href={buildContestDetailUrl(slug)} className={`${controlClass("onWash", "sm")} focus-visible:outline-white`}>
            <ArrowLeft size={14} aria-hidden="true" /> {card.contest.name}
          </Link>
        </nav>

        <article className={`${CARD} text-on-surface`} aria-labelledby="result-title">
          <p className={EYEBROW}>
            {card.contest.name} · {card.contest.dateRangeLabel}
          </p>
          <h1 id="result-title" className="mt-2 font-display text-3xl font-bold uppercase leading-none tracking-display sm:text-5xl">
            {card.rider.name}
          </h1>
          <p className={`mt-2 flex items-center gap-2 ${BODY}`}>
            <Medal size={16} aria-hidden="true" />
            {ordinal(best.rank)} in {best.label}
            {card.contest.place ? ` · ${card.contest.place}` : ""}
          </p>

          <ul className="mt-6 space-y-3" aria-label="Results by division">
            {card.results.map((result) => (
              <li key={result.divisionId}>
                <p className={LABEL}>{result.label}</p>
                <dl className="mt-1 grid grid-cols-3 gap-2">
                  <div className={TILE}>
                    <dt className={LABEL}>Rank</dt>
                    <dd className="mt-1 font-display text-xl font-bold tabular-nums">#{result.rank}</dd>
                  </div>
                  <div className={TILE}>
                    <dt className={LABEL}>Score</dt>
                    <dd className="mt-1 font-display text-xl font-bold tabular-nums">{result.score.toFixed(2)}</dd>
                  </div>
                  <div className={TILE}>
                    <dt className={LABEL}>{result.bestTrickScore !== null ? "Best trick" : "League pts"}</dt>
                    <dd className="mt-1 font-display text-xl font-bold tabular-nums">
                      {result.bestTrickScore !== null ? result.bestTrickScore.toFixed(2) : `+${result.pointsAwarded}`}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-3 border-t border-outline-variant pt-5">
            <p className={EYEBROW}>Share</p>
            <ShareActions url={url} title={`${card.rider.name} at ${card.contest.name}`} />
            <a href={`${url}/opengraph-image`} download={`${slug}-result.png`} className={controlClass("outline")}>
              <Download size={14} aria-hidden="true" /> Download card
            </a>
            {card.contest.visibility !== "public" ? (
              <p className={LABEL}>This contest is private: the link opens only for its members. The card image works anywhere.</p>
            ) : null}
          </div>
        </article>
      </div>
    </LeagueWash>
  );
}
