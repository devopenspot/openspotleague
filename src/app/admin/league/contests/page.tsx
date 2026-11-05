import Link from "next/link";
import { Plus } from "lucide-react";
import { connection } from "next/server";
import { AdminContestFilters } from "@/components/admin/league/contests/AdminContestFilters";
import { AdminContestsTable } from "@/components/admin/league/contests/AdminContestsTable";
import { getServerUserFromCookies } from "@/lib/auth/auth";
import { requireContestCurationRoleOrRedirect } from "@/lib/auth/server";
import {
  CONTEST_CURATION_LIMIT,
  listContestsForCuration,
  listEventPlans,
} from "@/lib/services/league";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

export const metadata = {
  title: "Admin · Contests",
};

interface AdminContestsPageProps {
  searchParams: Promise<{
    q?: string;
    plan?: string;
    visibility?: string;
    status?: string;
    featured?: string;
  }>;
}

const PILL =
  "inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary transition-colors hover:border-outline hover:text-on-surface";

export default async function AdminContestsPage({
  searchParams,
}: AdminContestsPageProps) {
  await connection();
  await requireContestCurationRoleOrRedirect("/admin/league/contests");
  const [user, params] = await Promise.all([
    getServerUserFromCookies(),
    searchParams,
  ]);
  const scope = user?.isAdministrator ? null : (user?.curatedCountryCodes ?? []);
  const visibility =
    params.visibility === "public" || params.visibility === "unlisted"
      ? params.visibility
      : undefined;
  const featured =
    params.featured === "true" ? true : params.featured === "false" ? false : undefined;

  const [items, plans] = await Promise.all([
    withSafeDefault(
      () =>
        listContestsForCuration(scope, {
          q: params.q,
          planSlug: params.plan || undefined,
          visibility,
          status: params.status || undefined,
          featured,
        }),
      [],
      "listContestsForCuration",
    ),
    withSafeDefault(() => listEventPlans(), [], "listEventPlans"),
  ]);

  return (
    <section
      id="admin-contests"
      aria-labelledby="admin-contests-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            League
          </span>
          <h1
            id="admin-contests-heading"
            className="font-display text-2xl font-bold uppercase tracking-tight text-on-surface md:text-[32px]"
          >
            Contests
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Every contest in your scope — free and paid, private and public.
            Curated contests are comped, can be listed publicly and featured on
            the League page.
            {scope !== null && scope.length === 0
              ? " You have no country scope yet — ask an admin to assign one."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.canManageLeague ? (
            <nav aria-label="League admin pages" className="flex gap-2">
              <Link href="/admin/league/payments" className={PILL}>
                Payments
              </Link>
              <Link href="/admin/league/plans" className={PILL}>
                Plans
              </Link>
            </nav>
          ) : null}
          <Link
            href="/admin/league/contests/new"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
          >
            <Plus size={13} aria-hidden="true" />
            New contest
          </Link>
        </div>
      </header>

      <AdminContestFilters values={params} plans={plans} />
      <AdminContestsTable
        items={items}
        truncated={items.length >= CONTEST_CURATION_LIMIT}
      />
    </section>
  );
}
