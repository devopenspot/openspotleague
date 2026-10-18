import { notFound } from "next/navigation"
import { connection } from "next/server"
import { requireSpotCurationRoleOrRedirect } from "@/lib/auth/server"
import { runFindSpotById } from "@/lib/services/spot/spots"
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { toSportOptions } from "@/lib/admin/taxonomy"
import type { SpotTypeEntity } from "@/lib/types"
import { AdminSpotForm } from "@/components/admin/spots/form/AdminSpotForm"

export const metadata = {
  title: "Admin · Edit spot",
}

interface AdminEditSpotPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminEditSpotPage({ params }: AdminEditSpotPageProps) {
  await connection()
  const { id: spotId } = await params
  await requireSpotCurationRoleOrRedirect(`/admin/spots/${spotId}`)
  const id = spotId
  const [spot, taxonomy] = await Promise.all([
    runFindSpotById(id),
    runListAdminTaxonomy(),
  ])
  if (!spot) notFound()
  const spotTypeOptions: readonly SpotTypeEntity[] = taxonomy.spotTypes.map(
    ({ slug, name }) => ({ slug, name }),
  )
  return (
    <AdminSpotForm
      mode="edit"
      spot={spot}
      spotTypes={spotTypeOptions}
      sportOptions={toSportOptions(taxonomy.sports)}
    />
  )
}
