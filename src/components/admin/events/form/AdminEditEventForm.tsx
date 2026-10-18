"use client"

import { AdminEventForm } from "@/components/admin/events/form/AdminEventForm"
import type { SportEventEnriched } from "@/types/sport-events"
import type { EventCategoryOption, SportOption } from "@/lib/admin/taxonomy"

interface AdminEditEventFormProps {
  event: SportEventEnriched
  sportOptions: readonly SportOption[]
  categoryOptions: readonly EventCategoryOption[]
}

export function AdminEditEventForm({
  event,
  sportOptions,
  categoryOptions,
}: AdminEditEventFormProps) {
  return (
    <AdminEventForm
      mode="edit"
      event={event}
      sportOptions={sportOptions}
      categoryOptions={categoryOptions}
    />
  )
}
