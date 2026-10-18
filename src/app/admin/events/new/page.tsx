import { AdminNewEventForm } from "@/components/admin/events/form/AdminNewEventForm"
import { connection } from "next/server"
import { requireEventCurationRoleOrRedirect } from "@/lib/auth/server"
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { toEventCategoryOptions, toSportOptions } from "@/lib/admin/taxonomy"

export const metadata = {
  title: "Admin · New event",
}

export default async function AdminNewEventPage() {
  await connection()
  await requireEventCurationRoleOrRedirect("/admin/events/new")
  const taxonomy = await runListAdminTaxonomy()
  return (
    <AdminNewEventForm
      sportOptions={toSportOptions(taxonomy.sports)}
      categoryOptions={toEventCategoryOptions(taxonomy.eventCategories)}
    />
  )
}
