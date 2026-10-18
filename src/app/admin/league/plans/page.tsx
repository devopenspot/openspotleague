import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  requireUserOrRedirect,
  requireCurationAccess,
} from "@/lib/auth/server";
import { AdminLeaguePlansTable } from "@/components/admin/league/plans/AdminLeaguePlansTable";

export const metadata = {
  title: "Admin · League plans",
};

export default async function AdminLeaguePlansPage() {
  await connection();
  await requireUserOrRedirect("/admin/league/plans");
  try {
    await requireCurationAccess("league.manage");
  } catch {
    redirect("/");
  }
  return (
    <section
      id="admin-league-plans"
      aria-labelledby="admin-league-plans-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            League
          </span>
          <h1
            id="admin-league-plans-heading"
            className="font-display text-2xl font-bold uppercase tracking-tight text-on-surface md:text-[32px]"
          >
            Plans
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Pricing tiers for community sport events. Existing plans are
            edit-only — new pricing ships as a new slug.
          </p>
        </div>
      </header>
      <AdminLeaguePlansTable />
    </section>
  );
}
