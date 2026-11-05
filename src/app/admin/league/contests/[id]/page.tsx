import Link from "next/link";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Settings2 } from "lucide-react";
import { ContestCurationPanel } from "@/components/admin/league/contests/ContestCurationPanel";
import {
  requireContestCurationAccess,
  requireContestCurationRoleOrRedirect,
} from "@/lib/auth/server";
import {
  formatDateRange,
  isOrganizerRole,
  statusLabel,
} from "@/lib/league/ui-state";
import {
  buildContestDetailUrl,
  buildContestManageUrl,
} from "@/lib/league/urls";
import {
  getContestCountryCode,
  getContestForCuration,
} from "@/lib/services/league";

export const metadata = {
  title: "Admin · Contest",
};

const PILL =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary transition-colors hover:border-outline hover:text-on-surface";

const DT = "font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary";

export default async function AdminContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const path = `/admin/league/contests/${id}`;
  const user = await requireContestCurationRoleOrRedirect(path);
  const countryCode = await getContestCountryCode(id);
  if (!countryCode) notFound();
  try {
    await requireContestCurationAccess(countryCode, "league.curate");
  } catch {
    redirect(`/admin/curation?denied=${encodeURIComponent(path)}`);
  }
  const state = await getContestForCuration(id, user.id);
  if (!state) notFound();
  const { event } = state;
  const isPublic = event.visibility === "public";
  const isOrganizer = isOrganizerRole(state.myRole);

  return (
    <section
      id="admin-contest"
      aria-labelledby="admin-contest-heading"
      className="space-y-6 animate-fade-in"
    >
      <Link href="/admin/league/contests" className={PILL}>
        <ArrowLeft size={12} aria-hidden="true" />
        Contests
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            {statusLabel(event.status)} · {event.planSlug} plan ·{" "}
            {isPublic ? "Public" : "Private"}
            {event.featured ? " · Featured" : ""}
          </span>
          <h1
            id="admin-contest-heading"
            className="font-display text-2xl font-bold uppercase tracking-tight text-on-surface md:text-[32px]"
          >
            {event.name}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublic || state.myRole ? (
            <Link href={buildContestDetailUrl(event.slug)} className={PILL}>
              Contest page
              <ExternalLink size={12} aria-hidden="true" />
            </Link>
          ) : null}
          {isOrganizer ? (
            <Link href={buildContestManageUrl(event.slug)} className={PILL}>
              Open console
              <Settings2 size={12} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <dt className={DT}>Dates</dt>
          <dd className="mt-1 text-sm text-on-surface">
            {formatDateRange(event.startDate, event.endDate)}
          </dd>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <dt className={DT}>Where</dt>
          <dd className="mt-1 text-sm text-on-surface">
            {event.city}, {event.country}
          </dd>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <dt className={DT}>People</dt>
          <dd className="mt-1 text-sm text-on-surface">
            {state.counts.riders} riders · {state.counts.judges} judges ·{" "}
            {state.counts.organizers} organizers
          </dd>
        </div>
        <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <dt className={DT}>Payment gate</dt>
          <dd className="mt-1 text-sm capitalize text-on-surface">
            {state.payment.state}
            {state.payment.activePayment
              ? ` · ${state.payment.activePayment.status}`
              : ""}
          </dd>
        </div>
      </dl>

      {state.results.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
          <table className="w-full text-left text-xs">
            <caption className="px-4 pt-3 text-left font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              Published results
            </caption>
            <thead className="border-b border-outline-variant font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              <tr>
                <th scope="col" className="px-4 py-2">Rank</th>
                <th scope="col" className="px-4 py-2">Rider</th>
                <th scope="col" className="px-4 py-2">Best run</th>
                <th scope="col" className="px-4 py-2">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {state.results.map((result) => (
                <tr key={result.userId}>
                  <td className="px-4 py-2 tabular-nums">#{result.rank}</td>
                  <td className="px-4 py-2">{result.riderName}</td>
                  <td className="px-4 py-2 tabular-nums">{result.totalScore.toFixed(2)}</td>
                  <td className="px-4 py-2 tabular-nums">+{result.pointsAwarded}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-secondary">
          {state.runs.length} scheduled run{state.runs.length === 1 ? "" : "s"} ·
          no published results yet.
        </p>
      )}

      <ContestCurationPanel
        event={event}
        canListPublicly={state.canListPublicly}
      />
    </section>
  );
}
