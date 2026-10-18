"use client"

import { AdminEventForm } from "@/components/admin/events/form/AdminEventForm"
import type { EventCategoryOption, SportOption } from "@/lib/admin/taxonomy"

export function AdminNewEventForm({
  sportOptions,
  categoryOptions,
}: {
  sportOptions: readonly SportOption[]
  categoryOptions: readonly EventCategoryOption[]
}) {
  return (
    <AdminEventForm
      mode="create"
      sportOptions={sportOptions}
      categoryOptions={categoryOptions}
    />
  )
}
