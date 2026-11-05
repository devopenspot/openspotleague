import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, Medal } from "lucide-react";
import {
  BODY,
  CARD,
  CARD_TITLE,
  EMPTY_STATE,
  EYEBROW,
  INPUT,
  LABEL,
  PAGE_TITLE,
  controlClass,
  pageContainer,
  tagClass,
} from "@/components/ui/recipes";
import { requireUserOrRedirect } from "@/lib/auth/server";
import { FORMAT_TEMPLATES, RATED_FORMATS, RATING_DISCIPLINES, disciplineLabel } from "@/lib/league/rating/formats";
import { LEAGUE_RANKING_PATH } from "@/lib/league/urls";
import { ROUTES } from "@/lib/navigation/nav";
import { leagueRankingQuerySchema } from "@/lib/schemas/league";
import { listLeagueRanking, type LeagueRankingRow } from "@/lib/services/league/standings";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

export const metadata = {
  title: "League ranking",
  description: "Top riders by league points, by discipline, format and country.",
  robots: { index: false, follow: false },
};

const SELECT = `${INPUT} appearance-none`;

export default async function LeagueRankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireUserOrRedirect(LEAGUE_RANKING_PATH);
  const raw = await searchParams;
  const parsed = leagueRankingQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw)
        .filter(([key, value]) => typeof value === "string" && value !== "" && ["discipline", "format", "country"].includes(key))
        .map(([key, value]) => [key, key === "country" ? String(value).toUpperCase() : value]),
    ),
  );
  const filters = parsed.success ? parsed.data : {};
  const rows: LeagueRankingRow[] = await withSafeDefault(() => listLeagueRanking(filters), [], "listLeagueRanking");
  const mine = rows.find((row) => row.userId === user.id) ?? null;
  const filtered = Boolean(filters.discipline || filters.format || filters.country);

  return (
    <div className={`${pageContainer("5xl")} text-on-surface`}>
      <Link href={ROUTES.league} className={controlClass("outline", "sm")}>
        <ArrowLeft size={14} aria-hidden="true" /> League
      </Link>
      <header className="mt-6">
        <p className={EYEBROW}>League</p>
        <h1 className={`mt-1 ${PAGE_TITLE}`}>Ranking</h1>
        <p className={`mt-2 max-w-xl ${BODY}`}>
          League points from published contests: 10 for taking part, plus a rank bonus in every division you ride.
          Filter by discipline and format to see who leads each one.
        </p>
      </header>

      <form method="get" className={`mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] ${CARD}`} aria-label="Ranking filters">
        <label className="block">
          <span className={LABEL}>Discipline</span>
          <select name="discipline" defaultValue={filters.discipline ?? ""} className={`mt-1 ${SELECT}`}>
            <option value="">All disciplines</option>
            {RATING_DISCIPLINES.map((discipline) => (
              <option key={discipline} value={discipline}>
                {disciplineLabel(discipline)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Format</span>
          <select name="format" defaultValue={filters.format ?? ""} className={`mt-1 ${SELECT}`}>
            <option value="">All formats</option>
            {RATED_FORMATS.map((format) => (
              <option key={format} value={format}>
                {FORMAT_TEMPLATES[format].label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Country code</span>
          <input
            name="country"
            defaultValue={filters.country ?? ""}
            placeholder="e.g. CO"
            maxLength={2}
            autoComplete="country"
            className={`mt-1 uppercase ${INPUT}`}
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={controlClass("primary")}>
            Apply
          </button>
          {filtered ? (
            <Link href={LEAGUE_RANKING_PATH} className={controlClass("outline")}>
              Clear
            </Link>
          ) : null}
        </div>
      </form>

      <section className={`mt-6 ${CARD}`} aria-label="Your position">
        {mine ? (
          <p className="text-sm text-on-surface">
            You&apos;re <strong className="tabular-nums">#{mine.position}</strong> with{" "}
            <strong className="tabular-nums">{mine.points}</strong> points.
          </p>
        ) : (
          <p className={BODY}>
            You&apos;re not in this top {rows.length > 0 ? rows.length : 50} yet. Join contests and ride every division
            you can to earn points.
          </p>
        )}
      </section>

      {rows.length === 0 ? (
        <div className={`mt-6 ${EMPTY_STATE}`}>
          <Medal size={24} aria-hidden="true" className="mx-auto text-secondary" />
          <p className={`mt-3 ${CARD_TITLE}`}>No points yet</p>
          <p className={`mx-auto mt-2 max-w-md ${BODY}`}>
            Points appear here once contests publish their results.
          </p>
        </div>
      ) : (
        <ol aria-label="League ranking" className={`mt-6 space-y-1.5 ${CARD}`}>
          {rows.map((row) => {
            const you = row.userId === user.id;
            return (
              <li key={row.userId} className={`flex items-center gap-3 rounded-inner px-3 py-2 ${you ? "bg-surface-container" : ""}`}>
                <span
                  aria-label={`Position ${row.position}`}
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control font-display text-sm font-bold tabular-nums ${row.position <= 3 ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"}`}
                >
                  {row.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{row.riderName}</span>
                    {you ? <span className={tagClass("solid")}>You</span> : null}
                  </p>
                  <p className={LABEL}>
                    {row.contests} contest{row.contests === 1 ? "" : "s"} · {row.wins} win{row.wins === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="font-display text-lg font-bold tabular-nums">{row.points}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
