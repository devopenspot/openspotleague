"use client"

import { useId } from "react"
import { CalendarDays, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"

const CONTROL_BASE =
  "w-full rounded-md border bg-surface-bright p-3 pr-10 text-base font-medium text-on-surface shadow-none transition-colors focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"

interface DateFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  error?: string
  hint?: string
  min?: string
  max?: string
  placeholder?: string
  id?: string
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatPreview(value: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function DateField({
  label,
  value,
  onChange,
  required = false,
  error,
  hint,
  min,
  max,
  placeholder = "YYYY-MM-DD",
  id: providedId,
}: DateFieldProps) {
  const autoId = useId()
  const id = providedId ?? autoId
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const previewId = `${id}-preview`
  const describedBy = [hintId, errorId, previewId].filter(Boolean).join(" ") || undefined
  const preview = formatPreview(value)
  const hasValue = value.trim().length > 0

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold tracking-[0.05em] text-secondary">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </label>

      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
          <CalendarDays size={14} />
        </span>

        <input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          min={min}
          max={max}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL_BASE, "pl-9", error && "border-error", !error && "border-outline-variant")}
        />

        {hasValue ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${label}`}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-secondary transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X size={12} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(todayIso())}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:border-outline hover:text-on-surface active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={`Set ${label} to today`}
        >
          Today
        </button>
        {hasValue ? (
          <span className="text-xs text-secondary">
            {preview ? preview : "Invalid date"}
          </span>
        ) : null}
        <span id={previewId} className="sr-only">
          {preview ? `${label} is ${preview}` : `${label} is empty`}
        </span>
      </div>

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
