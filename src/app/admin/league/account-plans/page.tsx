import { connection } from "next/server";
import { redirect } from "next/navigation";
import {
  requireUserOrRedirect,
  requireCurationAccess,
} from "@/lib/auth/server";
import { listEventPlans } from "@/lib/services/league";
import { withSafeDefault } from "@/lib/utils/safe-fetch";
import { AdminAccountPlansPanel } from "@/components/admin/league/plans/AdminAccountPlansPanel";

export const metadata = {
  title: "Admin · League account plans",
};

export default async function AdminAccountPlansPage() {
  await connection();
  await requireUserOrRedirect("/admin/league/account-plans");
  try {
    await requireCurationAccess("league.manage");
  } catch {
    redirect("/");
  }
  const plans = await withSafeDefault(
    () => listEventPlans(),
    [],
    "listEventPlans(admin)",
  );
  return (
    <section
      id="admin-league-account-plans"
      aria-labelledby="admin-league-account-plans-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            League
          </span>
          <h1
            id="admin-league-account-plans-heading"
            className="font-display text-2xl font-bold uppercase tracking-tight text-on-surface md:text-[32px]"
          >
            Account plans
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-secondary">
            Grant or revoke account-level plans. Revoked users fall back to the
            default/free monthly creation limit.
          </p>
        </div>
      </header>
      <AdminAccountPlansPanel plans={plans.map((plan) => plan.slug)} />
    </section>
  );
}
