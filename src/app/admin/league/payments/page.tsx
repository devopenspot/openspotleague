import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  requireUserOrRedirect,
  requireCurationAccess,
} from "@/lib/auth/server";
import { AdminLeaguePaymentsTable } from "@/components/admin/league/payments/AdminLeaguePaymentsTable";

export const metadata = {
  title: "Admin · League payments",
};

export default async function AdminLeaguePaymentsPage() {
  await connection();
  await requireUserOrRedirect("/admin/league/payments");
  try {
    await requireCurationAccess("league.manage");
  } catch {
    redirect("/");
  }
  return (
    <section
      id="admin-league-payments"
      aria-labelledby="admin-league-payments-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            League
          </span>
          <h1
            id="admin-league-payments-heading"
            className="font-display text-2xl font-bold uppercase tracking-tight text-on-surface md:text-[32px]"
          >
            Payments
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Review registered event payments. Marking paid or comped unlocks the
            event plan and raises the organizer&apos;s account quota.
          </p>
        </div>
        <nav aria-label="League admin pages" className="flex gap-2">
          <Link
            href="/admin/league/plans"
            className="inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary transition-colors hover:border-outline hover:text-on-surface"
          >
            Plans
          </Link>
          <Link
            href="/admin/league/account-plans"
            className="inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary transition-colors hover:border-outline hover:text-on-surface"
          >
            Account plans
          </Link>
        </nav>
      </header>
      <AdminLeaguePaymentsTable />
    </section>
  );
}
