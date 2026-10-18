"use client"

import { useId } from "react"
import { cn } from "@/lib/utils/cn"
import type { SportDiscipline } from "@/types/sport-events"
import type { EventCategoryOption, SportOption } from "@/lib/admin/taxonomy"
import type { ProjectedAddress } from "@/lib/geocode/project"
import {
  CountryAutocomplete,
  type CountrySelection,
} from "@/components/admin/spots/form/CountryAutocomplete"
import {
  ImageSourceField,
  type ImageSourceFieldValue,
} from "@/components/admin/spots/form/ImageSourceField"
import {
  LatLonEditor,
  type LatLonEditorMode,
} from "@/components/admin/spots/form/LatLonEditor"
import {
  normalizeEventCitySlug,
  type EventFormErrors,
  type EventFormState,
} from "./event-form-model"
import { DateField } from "./DateField"

export type { EventFormErrors, EventFormState } from "./event-form-model"

const CONTROL_CLASSES =
  "w-full rounded-md border border-outline-variant bg-surface-bright p-3 text-sm font-medium text-on-surface shadow-none transition-colors focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
  required?: boolean
  error?: string
  hint?: string
  autoComplete?: string
  min?: number
  max?: number
  step?: string
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  error,
  hint,
  autoComplete,
  min,
  max,
  step,
}: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
      >
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(CONTROL_CLASSES, error && "border-error")}
      />
      {hint ? (
        <p id={hintId} className="mt-1 text-xs leading-5 text-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

interface TextareaFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
}

function TextareaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: TextareaFieldProps) {
  const errorId = `${id}-error`
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(CONTROL_CLASSES, "resize-y", error && "border-error")}
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function PanelIntro({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 max-w-2xl text-xs leading-5 text-secondary">{children}</p>
}

interface EventLocationFieldsProps {
  state: EventFormState
  onChange: (next: EventFormState) => void
  errors: EventFormErrors
  latLonMode: LatLonEditorMode
  onAutoFillResult?: (address: ProjectedAddress) => void
  onError?: (message: string) => void
}

function EventLocationFields({
  state,
  onChange,
  errors,
  latLonMode,
  onAutoFillResult,
  onError,
}: EventLocationFieldsProps) {
  const cityId = useId()
  const citySlugId = useId()
  const addressId = useId()
  const countryId = useId()
  const venueId = useId()

  const latitude = Number(state.latitude)
  const longitude = Number(state.longitude)
  const lat = Number.isFinite(latitude) ? latitude : 0
  const lon = Number.isFinite(longitude) ? longitude : 0

  const handleCountryChange = (next: CountrySelection) => {
    onChange({ ...state, country: next.name, countryCode: next.code })
  }

  return (
    <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
      <legend className="px-1 text-sm font-bold tracking-[0.05em] text-on-surface">
        Location
      </legend>
      <PanelIntro>
        Add the event coordinates first. A successful lookup can fill the city,
        country, address, and city slug, and every value remains editable.
      </PanelIntro>

      <LatLonEditor
        lat={lat}
        lon={lon}
        mode={latLonMode}
        required
        invalid={Boolean(errors.location)}
        resourceLabel="event"
        onChange={(nextLat, nextLon) =>
          onChange({
            ...state,
            latitude: String(nextLat),
            longitude: String(nextLon),
          })
        }
        onAutoFillResult={onAutoFillResult}
        onError={onError}
      />
      {errors.location ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {errors.location}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id={cityId}
          label="City"
          value={state.city}
          onChange={(city) =>
            onChange({
              ...state,
              city,
              citySlug: state.citySlug || normalizeEventCitySlug(city),
            })
          }
          placeholder="e.g. Montpellier"
          required
          error={errors.city}
          autoComplete="address-level2"
        />
        <Field
          id={citySlugId}
          label="City slug"
          value={state.citySlug}
          onChange={(citySlug) =>
            onChange({
              ...state,
              citySlug: normalizeEventCitySlug(citySlug),
            })
          }
          placeholder="montpellier"
          hint="Derived from the city when left blank."
          error={errors.citySlug}
        />
        <div>
          <label
            htmlFor={countryId}
            className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
          >
            Country <span aria-hidden="true">*</span>
          </label>
          <CountryAutocomplete
            id={countryId}
            value={{ name: state.country, code: state.countryCode }}
            onChange={handleCountryChange}
            onError={onError}
            invalid={Boolean(errors.country)}
          />
          {errors.country ? (
            <p role="alert" className="mt-1 text-xs text-error">
              {errors.country}
            </p>
          ) : null}
        </div>
        <Field
          id={venueId}
          label="Venue"
          value={state.venue}
          onChange={(venue) => onChange({ ...state, venue })}
          placeholder="e.g. Olympic Stadium"
          error={errors.venue}
        />
        <div className="sm:col-span-2">
          <Field
            id={addressId}
            label="Address"
            value={state.address}
            onChange={(address) => onChange({ ...state, address })}
            placeholder="e.g. 1111 S Figueroa St"
            error={errors.address}
            autoComplete="street-address"
          />
        </div>
      </div>
    </fieldset>
  )
}

interface EventFormFieldsProps {
  state: EventFormState
  onChange: (next: EventFormState) => void
  errors?: EventFormErrors
  latLonMode?: LatLonEditorMode
  onAutoFillResult?: (address: ProjectedAddress) => void
  onError?: (message: string) => void
  sportOptions: readonly SportOption[]
  categoryOptions: readonly EventCategoryOption[]
}

export function EventFormFields({
  state,
  onChange,
  errors = {},
  latLonMode = "preview",
  onAutoFillResult,
  onError,
  sportOptions,
  categoryOptions,
}: EventFormFieldsProps) {
  const nameId = useId()
  const shortNameId = useId()
  const urlId = useId()
  const descriptionId = useId()
  const startDateId = useId()
  const endDateId = useId()
  const tierId = useId()
  const featuredId = useId()
  const instagramId = useId()
  const youtubeId = useId()
  const disciplinesId = useId()
  const errorSummaryId = useId()

  const update = <K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) => onChange({ ...state, [key]: value })

  const toggleSport = (sport: SportDiscipline) => {
    update(
      "sports",
      state.sports.includes(sport)
        ? state.sports.filter((current) => current !== sport)
        : [...state.sports, sport],
    )
  }

  const errorEntries = Object.entries(errors).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  )

  return (
    <div className="space-y-6">
      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <legend className="px-1 text-sm font-bold tracking-[0.05em] text-on-surface">
          Event essentials
        </legend>
        <PanelIntro>
          Start with the public identity and official source riders will use to
          learn more.
        </PanelIntro>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id={nameId}
            label="Event name"
            value={state.name}
            onChange={(value) => update("name", value)}
            placeholder="e.g. World Skate Games 2026"
            required
            error={errors.name}
            autoComplete="off"
          />
          <Field
            id={shortNameId}
            label="Short name"
            value={state.shortName}
            onChange={(value) => update("shortName", value)}
            placeholder="e.g. WSG26"
            error={errors.shortName}
            autoComplete="off"
          />
          <div className="sm:col-span-2">
            <Field
              id={urlId}
              label="Official URL"
              value={state.url}
              onChange={(value) => update("url", value)}
              type="url"
              placeholder="https://example.com/event"
              required
              error={errors.url}
              autoComplete="url"
            />
          </div>
          <div className="sm:col-span-2">
            <TextareaField
              id={descriptionId}
              label="Description"
              value={state.description}
              onChange={(value) => update("description", value)}
              placeholder="A short, useful description of the event…"
              error={errors.description}
            />
          </div>
        </div>
      </fieldset>

      <div>
        <ImageSourceField
          value={state.image}
          onChange={(value: ImageSourceFieldValue) => update("image", value)}
        />
        {errors.image ? (
          <p role="alert" className="mt-2 text-xs text-error">
            {errors.image}
          </p>
        ) : null}
      </div>

      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <legend className="px-1 text-sm font-bold tracking-[0.05em] text-on-surface">
          Schedule
        </legend>
        <PanelIntro>
          Use calendar dates as they should appear in the public event
          directory. Dates are calendar dates, not timed appointments; no local
          timezone conversion is applied. The end date may match the start date
          for a one-day event.
        </PanelIntro>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <DateField
            id={startDateId}
            label="Start date"
            value={state.startDate}
            onChange={(value) => update("startDate", value)}
            required
            error={errors.startDate}
            hint="First day the event is visible as live."
          />
          <DateField
            id={endDateId}
            label="End date"
            value={state.endDate}
            onChange={(value) => update("endDate", value)}
            error={errors.endDate}
            min={state.startDate || undefined}
            hint={
              state.startDate && state.endDate && state.endDate < state.startDate
                ? "Must be on or after start date."
                : "Leave blank for a one-day event. Clear with ✕."
            }
          />
        </div>
        {state.startDate && state.endDate && state.startDate !== state.endDate && !errors.endDate && !errors.startDate ? (
          <p className="mt-3 text-xs text-secondary" aria-live="polite">
            {(() => {
              const s = new Date(`${state.startDate}T00:00:00Z`)
              const e = new Date(`${state.endDate}T00:00:00Z`)
              if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
              const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1
              return `${days} day${days === 1 ? "" : "s"} · ${s.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} → ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`
            })()}
          </p>
        ) : state.startDate && !state.endDate && !errors.startDate ? (
          <p className="mt-3 text-xs text-secondary" aria-live="polite">
            One-day event on{" "}
            {new Date(`${state.startDate}T00:00:00Z`).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : null}
      </fieldset>

      <EventLocationFields
        state={state}
        onChange={onChange}
        errors={errors}
        latLonMode={latLonMode}
        onAutoFillResult={onAutoFillResult}
        onError={onError}
      />

      <fieldset
        id={disciplinesId}
        className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6"
      >
        <legend className="px-1 text-sm font-bold tracking-[0.05em] text-on-surface">
          Disciplines
        </legend>
        <PanelIntro>Pick every discipline represented by this event.</PanelIntro>
        <ul className="flex flex-wrap gap-2" aria-label="Event disciplines">
          {sportOptions.map((sportOption) => {
            const active = state.sports.includes(sportOption.value)
            return (
              <li key={sportOption.value}>
                <label
                  className={cn(
                    "inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-bright text-on-surface hover:border-outline",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleSport(sportOption.value)}
                    className="sr-only"
                    aria-label={sportOption.label}
                  />
                  {sportOption.label}
                </label>
              </li>
            )
          })}
        </ul>
        {errors.sports ? (
          <p role="alert" className="mt-2 text-xs text-error">
            {errors.sports}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <legend className="px-1 text-sm font-bold tracking-[0.05em] text-on-surface">
          Publishing
        </legend>
        <PanelIntro>
          Set how prominently the event is classified and whether it should be
          promoted in the public directory.
        </PanelIntro>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:items-end">
          <div>
            <label
              htmlFor={tierId}
              className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary"
            >
              Tier <span aria-hidden="true">*</span>
            </label>
            <select
              id={tierId}
              value={state.category}
              onChange={(event) =>
                update("category", event.target.value as EventFormState["category"])
              }
              aria-invalid={errors.category ? true : undefined}
              className={cn(CONTROL_CLASSES, errors.category && "border-error")}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.category ? (
              <p role="alert" className="mt-1 text-xs text-error">
                {errors.category}
              </p>
            ) : null}
          </div>
          <label
            htmlFor={featuredId}
            className="flex min-h-11 items-center gap-3 rounded-md border border-outline-variant bg-surface-bright px-3 text-sm font-medium text-on-surface"
          >
            <input
              id={featuredId}
              type="checkbox"
              checked={state.featured}
              onChange={(event) => update("featured", event.target.checked)}
              className="h-5 w-5 accent-primary"
            />
            <span>Feature this event in the public directory</span>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-5 sm:p-6">
        <legend className="px-1 text-sm font-bold tracking-[0.05em] text-on-surface">
          Social profiles
        </legend>
        <PanelIntro>
          Add public organizer profiles. Leave either field blank when the
          event has no presence on that platform.
        </PanelIntro>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            id={instagramId}
            label="Instagram"
            value={state.instagram}
            onChange={(value) => update("instagram", value)}
            type="url"
            placeholder="https://instagram.com/handle"
            error={errors.instagram}
            autoComplete="url"
          />
          <Field
            id={youtubeId}
            label="YouTube"
            value={state.youtube}
            onChange={(value) => update("youtube", value)}
            type="url"
            placeholder="https://youtube.com/@handle"
            error={errors.youtube}
            autoComplete="url"
          />
        </div>
      </fieldset>

      {errorEntries.length > 0 ? (
        <div
          id={errorSummaryId}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          <p className="font-semibold">Review the highlighted fields.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errorEntries.map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
