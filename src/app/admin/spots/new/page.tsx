import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { toSportOptions } from "@/lib/admin/taxonomy"
import { connection } from "next/server"
import { requireSpotCurationRoleOrRedirect } from "@/lib/auth/server"
import type { SpotTypeEntity } from "@/lib/types"
import { AdminSpotForm } from "@/components/admin/spots/form/AdminSpotForm"

export const metadata = {
  title: "Admin · New spot",
}

export default async function AdminNewSpotPage() {
  await connection()
  await requireSpotCurationRoleOrRedirect("/admin/spots/new")
  const { sports, spotTypes } = await runListAdminTaxonomy()
  const spotTypeOptions: readonly SpotTypeEntity[] = spotTypes.map(
    ({ slug, name }) => ({ slug, name }),
  )
  const initialTypeSlug = spotTypeOptions[0]?.slug ?? null
  return (
    <AdminSpotForm
      mode="create"
      spotTypes={spotTypeOptions}
      sportOptions={toSportOptions(sports)}
      initialTypeSlug={initialTypeSlug}
    />
  )
}
