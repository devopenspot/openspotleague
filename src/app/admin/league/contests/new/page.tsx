import { connection } from "next/server";
import { LeagueCreateForm } from "@/components/league/create/LeagueCreateForm";
import { requireContestCurationRoleOrRedirect } from "@/lib/auth/server";
import { listEventPlans } from "@/lib/services/league";
import { withSafeDefault } from "@/lib/utils/safe-fetch";

export const metadata = {
  title: "Admin · New contest",
};

export default async function AdminNewContestPage() {
  await connection();
  await requireContestCurationRoleOrRedirect("/admin/league/contests/new");
  const plans = await withSafeDefault(() => listEventPlans(), [], "listEventPlans");
  return (
    <LeagueCreateForm
      curator={{
        plans: plans
          .filter((plan) => plan.active)
          .map((plan) => ({
            slug: plan.slug,
            name: plan.name,
            maxRiders: plan.maxRiders,
          })),
      }}
    />
  );
}
