"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { showToast } from "@/hooks/ui/useToast"
import { SpotFormFields } from "./SpotFormFields"
import type { Spot, SpotTypeEntity } from "@/lib/types"
import type { SportOption } from "@/lib/admin/taxonomy"
import type { ProjectedAddress } from "@/lib/geocode/project"
import {
  buildInitialSpotState,
  buildSpotFormData,
  errorsFromSpotApiDetails,
  normalizeSpotCitySlug,
  stateFromSpot,
  validateSpotFormState,
  type SpotFormErrors,
  type SpotFormState,
} from "./spot-form-model"

type AdminSpotFormProps =
  | {
      mode: "create"
      spot?: never
      spotTypes: readonly SpotTypeEntity[]
      sportOptions: readonly SportOption[]
      initialTypeSlug: string | null
    }
  | {
      mode: "edit"
      spot: Spot
      spotTypes: readonly SpotTypeEntity[]
      sportOptions: readonly SportOption[]
      initialTypeSlug?: never
    }

interface ApiActionError extends Error {
  details?: unknown
}

function applyAddress(state: SpotFormState, address: ProjectedAddress): SpotFormState {
  return {
    ...state,
    city: state.city || address.city || "",
    citySlug: state.citySlug || normalizeSpotCitySlug(address.city ?? ""),
    country: state.country || address.country || "",
    countryCode: state.countryCode || address.countryCode || "",
    address: state.address || [address.houseNumber, address.road].filter(Boolean).join(" "),
    lat: address.lat,
    lon: address.lon,
  }
}

export function AdminSpotForm(props: AdminSpotFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<SpotFormErrors>({})

  const isEdit = props.mode === "edit"
  const spot = isEdit ? props.spot : null

  const [state, setState] = useState<SpotFormState>(() =>
    isEdit && spot ? stateFromSpot(spot) : buildInitialSpotState(props.initialTypeSlug ?? ""),
  )

  const handleChange = (next: SpotFormState) => {
    setState(next)
    if (Object.keys(errors).length > 0) setErrors({})
  }

  const handleAction = async (formData: FormData) => {
    const url = isEdit && spot ? `/api/admin/spots/${encodeURIComponent(spot.id)}` : "/api/admin/spots"
    const response = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      body: formData,
    })
    if (response.status === 401) {
      router.push("/login")
      throw new Error("Your session has expired. Sign in again to continue.")
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string; details?: unknown } | null
      const error = new Error(body?.error ?? `Unable to save spot (${response.status}).`) as ApiActionError
      error.details = body?.details
      throw error
    }
    return (await response.json()) as { id: string }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending) return

    const nextErrors = validateSpotFormState(state)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      showToast("Review the highlighted spot fields.", "error")
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      })
      return
    }

    setErrors({})
    const formData = buildSpotFormData(
      state,
      props.mode,
      isEdit && spot ? spot.updatedAt : undefined,
      isEdit && spot ? spot.image : undefined,
    )
    startTransition(async () => {
      try {
        const result = await handleAction(formData)
        showToast(isEdit ? "Spot updated" : "Spot created", "success")
        if (!isEdit) setState(buildInitialSpotState(props.initialTypeSlug ?? ""))
        router.push(isEdit && spot ? `/admin/spots/${spot.id}` : `/admin/spots/${result.id}`)
        router.refresh()
      } catch (error) {
        const actionError = error as ApiActionError
        const apiErrors = errorsFromSpotApiDetails(actionError.details)
        if (Object.keys(apiErrors).length > 0) setErrors(apiErrors)
        showToast(actionError.message || "Unable to save spot.", "error")
      }
    })
  }

  const heading = isEdit && spot ? spot.name : "Register new obstacle"
  const eyebrow = isEdit ? "Edit entry" : "Contribute to cartography"
  const description = isEdit
    ? "Update the public spot record. Changes are written to the spots cache immediately."
    : "Map your local ledges, stairs, DIYs, or pools. Provide accurate metadata to help fellow skaters coordinate sessions safely."

  return (
    <section
      id={isEdit ? "admin-edit-spot" : "admin-new-spot"}
      aria-labelledby={isEdit ? "admin-edit-spot-heading" : "admin-new-spot-heading"}
      className="animate-fade-in space-y-6"
    >
      <header className="flex w-full flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div className="min-w-0 flex-1">
          <span className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            {eyebrow}
          </span>
          <h1
            id={isEdit ? "admin-edit-spot-heading" : "admin-new-spot-heading"}
            className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl"
          >
            {heading}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {isEdit && spot ? (
              <>
                Last updated <time dateTime={spot.updatedAt}>{spot.updatedAt}</time>. Changes are written to the spots cache immediately.
              </>
            ) : (
              description
            )}
          </p>
        </div>
        {isEdit ? (
          <Link
            href="/admin/spots/new"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
          >
            <Plus size={13} aria-hidden="true" />
            New spot
          </Link>
        ) : null}
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-8">
        <fieldset disabled={pending} className="space-y-8 disabled:opacity-60">
          <SpotFormFields
            state={state}
            onChange={handleChange}
            errors={errors}
            latLonMode={isEdit ? "preview" : "auto-fill"}
            onAutoFillResult={(address) => setState((s) => applyAddress(s, address))}
            onError={(message) => showToast(message, "error")}
            spotTypes={props.spotTypes}
            sportOptions={props.sportOptions}
          />
        </fieldset>

        <div className="flex justify-end gap-1.5 border-t border-outline-variant pt-5">
          <button
            type="button"
            onClick={() => router.push("/admin/spots")}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? (isEdit ? "Saving…" : "Registering…") : isEdit ? "Save changes" : "Register Spot"}
          </button>
        </div>
      </form>

      <button
        type="button"
        onClick={() => router.push("/admin/spots")}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
      >
        Back to spots
      </button>
    </section>
  )
}
