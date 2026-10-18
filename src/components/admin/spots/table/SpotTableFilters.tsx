"use client"

import { useEffect, useId, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import type { SportOption } from "@/lib/admin/taxonomy"
import type { SportDiscipline } from "@/types/sport-events"
import { useSpotsStore } from "@/stores/spots-store"

function parseTypesParam(value: string | null): string[] {
  if (!value) return []
  return Array.from(
    new Set(
      value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s.length > 0),
    ),
  )
}

function typesToParam(types: readonly string[]): string {
  return Array.from(new Set(types.map((t) => t.trim().toLowerCase()))).join(",")
}

export function SpotTableFilters({
  sportOptions,
}: {
  sportOptions: readonly SportOption[]
}) {
  const qId = useId()
  const countryId = useId()
  const sportId = useId()
  const typesFieldsetId = useId()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const spotTypes = useSpotsStore((s) => s.spotTypes)

  const [q, setQ] = useState(searchParams.get("q") ?? "")
  const [types, setTypes] = useState<string[]>(
    parseTypesParam(searchParams.get("type")),
  )
  const [country, setCountry] = useState(searchParams.get("country") ?? "")
  const initialSport = searchParams.get("sport") as SportDiscipline | null
  const [sport, setSport] = useState<SportDiscipline | "">(
    initialSport && sportOptions.some((option) => option.value === initialSport)
      ? initialSport
      : "",
  )

  const emit = (next: {
    q: string
    types: string[]
    country: string
    sport: SportDiscipline | ""
  }) => {
    const params = new URLSearchParams()
    if (next.q.trim()) params.set("q", next.q.trim())
    const typesValue = typesToParam(next.types)
    if (typesValue) params.set("type", typesValue)
    if (next.country.trim()) params.set("country", next.country.trim())
    if (next.sport) params.set("sport", next.sport)
    const qs = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    })
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setQ(searchParams.get("q") ?? "")
      setTypes(parseTypesParam(searchParams.get("type")))
      setCountry(searchParams.get("country") ?? "")
      const nextSport = searchParams.get("sport") as SportDiscipline | null
      setSport(
        nextSport && sportOptions.some((option) => option.value === nextSport)
          ? nextSport
          : "",
      )
    })
    return () => cancelAnimationFrame(frame)
  }, [searchParams, sportOptions])

  const toggleType = (slug: string) => {
    const next = types.includes(slug)
      ? types.filter((current) => current !== slug)
      : [...types, slug]
    setTypes(next)
    emit({ q, types: next, country, sport })
  }

  const hasFilters = Boolean(q.trim() || country.trim() || sport || types.length)

  return (
    <div className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <div className="w-full">
          <label
            htmlFor={qId}
            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Search
          </label>
          <div className="relative">
            <Search
              size={12}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
            />
            <input
              id={qId}
              type="search"
              value={q}
              onChange={(event) => {
                const value = event.target.value
                setQ(value)
                emit({ q: value, types, country, sport })
              }}
              placeholder="Name, city, address, feature…"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3 pl-8 pr-3 text-base font-medium text-on-surface shadow-none focus:border-primary focus:outline-none sm:text-sm"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor={countryId}
            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Country
          </label>
          <input
            id={countryId}
            type="text"
            value={country}
            onChange={(event) => {
              const value = event.target.value
              setCountry(value)
              emit({ q, types, country: value, sport })
            }}
            placeholder="e.g. France"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-primary focus:outline-none sm:text-sm"
          />
        </div>
        <div>
          <label
            htmlFor={sportId}
            className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Sport
          </label>
          <select
            id={sportId}
            value={sport}
            onChange={(event) => {
              const value = event.target.value as SportDiscipline | ""
              setSport(value)
              emit({ q, types, country, sport: value })
            }}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-primary focus:outline-none sm:text-sm"
          >
            <option value="">All sports</option>
            {sportOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset
        id={typesFieldsetId}
        className="rounded-lg border border-outline-variant bg-surface-container-low p-3"
      >
        <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Spot types
        </legend>
        <ul
          className="flex flex-wrap gap-1.5"
          aria-label="Filter by spot type (match any)"
        >
          {spotTypes.map((type) => {
            const active = types.includes(type.slug)
            return (
              <li key={type.slug}>
                <button
                  type="button"
                  onClick={() => toggleType(type.slug)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] transition-colors duration-150 ease-out active:scale-[0.99]",
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-outline-variant bg-surface-container-lowest text-secondary hover:border-outline hover:text-on-surface",
                  )}
                >
                  {type.name}
                </button>
              </li>
            )
          })}
        </ul>
        {types.length > 0 ? (
          <p
            className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary"
            aria-live="polite"
          >
            Match any of {types.length} type{types.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </fieldset>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => {
            setQ("")
            setTypes([])
            setCountry("")
            setSport("")
            emit({ q: "", types: [], country: "", sport: "" })
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
        >
          <X size={13} aria-hidden="true" />
          Clear filters
        </button>
      ) : null}
    </div>
  )
}
