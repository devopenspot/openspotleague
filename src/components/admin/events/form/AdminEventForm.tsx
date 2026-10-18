"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { showToast } from "@/hooks/ui/useToast"
import type { ProjectedAddress } from "@/lib/geocode/project"
import type { EventCategoryOption, SportOption } from "@/lib/admin/taxonomy"
import type { SportEventEnriched } from "@/types/sport-events"
import { EventFormFields } from "./EventFormFields"
import { EventFormSubmit } from "./EventFormSubmit"
import {
  buildEventFormData,
  buildInitialEventState,
  errorsFromApiDetails,
  normalizeEventCitySlug,
  stateFromEvent,
  validateEventFormState,
  type EventFormErrors,
  type EventFormState,
} from "./event-form-model"

type AdminEventFormProps =
  | {
      mode: "create"
      event?: never
      sportOptions: readonly SportOption[]
      categoryOptions: readonly EventCategoryOption[]
    }
  | {
      mode: "edit"
      event: SportEventEnriched
      sportOptions: readonly SportOption[]
      categoryOptions: readonly EventCategoryOption[]
    }

interface ApiActionError extends Error {
  details?: unknown
}

function applyAddress(
  state: EventFormState,
  address: ProjectedAddress,
): EventFormState {
  return {
    ...state,
    city: state.city || address.city || "",
    citySlug:
      state.citySlug || normalizeEventCitySlug(address.city ?? ""),
    country: state.country || address.country || "",
    countryCode: state.countryCode || address.countryCode || "",
    address:
      state.address ||
      [address.houseNumber, address.road].filter(Boolean).join(" "),
    latitude: String(address.lat),
    longitude: String(address.lon),
  }
}

export function AdminEventForm({
  mode,
  event,
  sportOptions,
  categoryOptions,
}: AdminEventFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<EventFormErrors>({})
  const [state, setState] = useState<EventFormState>(() =>
    mode === "edit" && event
      ? stateFromEvent(event)
      : buildInitialEventState(),
  )

  const handleChange = (next: EventFormState) => {
    setState(next)
    if (Object.keys(errors).length > 0) setErrors({})
  }

  const handleAction = async (formData: FormData) => {
    const url =
      mode === "edit" && event
        ? `/api/admin/events/${encodeURIComponent(event.id)}`
        : "/api/admin/events"
    const response = await fetch(url, {
      method: mode === "edit" ? "PATCH" : "POST",
      body: formData,
    })

    if (response.status === 401) {
      router.push("/login")
      throw new Error("Your session has expired. Sign in again to continue.")
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
        details?: unknown
      } | null
      const error = new Error(
        body?.error ?? `Unable to save event (${response.status}).`,
      ) as ApiActionError
      error.details = body?.details
      throw error
    }

    return (await response.json()) as { id: string }
  }

  const handleSubmit = (eventObject: React.FormEvent<HTMLFormElement>) => {
    eventObject.preventDefault()
    if (pending) return

    const nextErrors = validateEventFormState(state)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      showToast("Review the highlighted event fields.", "error")
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>("[aria-invalid=\"true\"]")
          ?.focus()
      })
      return
    }

    setErrors({})
    const formData = buildEventFormData(
      state,
      mode,
      mode === "edit" && event ? event.updatedAt : undefined,
      mode === "edit" && event ? event.image : undefined,
    )
    startTransition(async () => {
      try {
        const result = await handleAction(formData)
        showToast(mode === "edit" ? "Event updated" : "Event created", "success")
        if (mode === "create") setState(buildInitialEventState())
        router.push(`/admin/events/${result.id}`)
        router.refresh()
      } catch (error) {
        const actionError = error as ApiActionError
        const apiErrors = errorsFromApiDetails(actionError.details)
        if (Object.keys(apiErrors).length > 0) setErrors(apiErrors)
        showToast(actionError.message || "Unable to save event.", "error")
      }
    })
  }

  const isEdit = mode === "edit" && event
  const heading = isEdit ? event.name : "New event"
  const eyebrow = isEdit ? "Edit event" : "Add to the calendar"
  const description = isEdit
    ? "Update the public event record. Changes are written to the events cache immediately."
    : "Create a clear, accurate event record for the public directory."

  return (
    <section
      id={isEdit ? "admin-edit-event" : "admin-new-event"}
      aria-labelledby={isEdit ? "admin-edit-event-heading" : "admin-new-event-heading"}
      className="animate-fade-in space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block text-xs font-semibold tracking-[0.05em] text-secondary">
            {eyebrow}
          </span>
          <h1
            id={isEdit ? "admin-edit-event-heading" : "admin-new-event-heading"}
            className="max-w-3xl font-display text-3xl font-bold leading-tight tracking-[-0.02em] text-on-surface sm:text-4xl"
          >
            {heading}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {description}
          </p>
        </div>
        {isEdit ? (
          <Link
            href="/admin/events/new"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
          >
            <Plus size={13} aria-hidden="true" />
            New event
          </Link>
        ) : null}
      </header>

      {isEdit ? (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-5 sm:grid-cols-5">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              Status
            </dt>
            <dd className="mt-1 text-sm font-semibold capitalize text-on-surface">
              {event.status}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              Dates
            </dt>
            <dd className="mt-1 text-sm font-semibold text-on-surface">
              {event.dateRangeLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              Tier
            </dt>
            <dd className="mt-1 text-sm font-semibold text-on-surface">
              {event.categoryName}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              Featured
            </dt>
            <dd className="mt-1 text-sm font-semibold text-on-surface">
              {event.featured ? "Yes" : "No"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              Updated
            </dt>
            <dd className="mt-1 text-sm font-semibold text-on-surface">
              <time dateTime={event.updatedAt}>{event.updatedAt}</time>
            </dd>
          </div>
        </dl>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <EventFormFields
          state={state}
          onChange={handleChange}
          errors={errors}
          latLonMode={mode === "create" ? "auto-fill" : "preview"}
          sportOptions={sportOptions}
          categoryOptions={categoryOptions}
          onAutoFillResult={(address) =>
            setState((current) => applyAddress(current, address))
          }
          onError={(message) => showToast(message, "error")}
        />
        <EventFormSubmit
          pending={pending}
          onCancel={() => router.push("/admin/events")}
          label={mode === "edit" ? "Save changes" : "Create event"}
          pendingLabel={mode === "edit" ? "Saving…" : "Creating…"}
        />
      </form>
    </section>
  )
}
