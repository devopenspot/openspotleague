import { notFound } from "next/navigation"
import { connection } from "next/server"
import { requireEventCurationRoleOrRedirect } from "@/lib/auth/server"
import { runFindEventById } from "@/lib/services/event/events"
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { toEventCategoryOptions, toSportOptions } from "@/lib/admin/taxonomy"
import { AdminEditEventForm } from "@/components/admin/events/form/AdminEditEventForm"

export const metadata = {
  title: "Admin · Edit event",
}

interface AdminEditEventPageProps {
  params: Promise<{ id: string }>
}

export default async function AdminEditEventPage({ params }: AdminEditEventPageProps) {
  await connection()
  const { id: eventId } = await params
  await requireEventCurationRoleOrRedirect(`/admin/events/${eventId}`)
  const id = eventId
  const [event, taxonomy] = await Promise.all([
    runFindEventById(id),
    runListAdminTaxonomy(),
  ])
  if (!event) notFound()
  return (
    <AdminEditEventForm
      event={event}
      sportOptions={toSportOptions(taxonomy.sports)}
      categoryOptions={toEventCategoryOptions(taxonomy.eventCategories)}
    />
  )
}
