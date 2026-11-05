"use client"

import { AdminEventForm } from "@/components/admin/events/form/AdminEventForm"
import type { ContestEnriched } from "@/types/league"
import type { EventCategoryOption, SportOption } from "@/lib/admin/taxonomy"

interface AdminEditEventFormProps {
  event: ContestEnriched
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
