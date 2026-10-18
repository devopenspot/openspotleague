"use client"

import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react"
import { Search, X } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils/cn"
import type { EventCategoryOption, SportOption } from "@/lib/admin/taxonomy"
import type { SportDiscipline, SportEventCategory } from "@/types/sport-events"

interface EventTableFiltersProps {
  sportOptions: readonly SportOption[]
  categoryOptions: readonly EventCategoryOption[]
}

export function EventTableFilters({
  sportOptions,
  categoryOptions,
}: EventTableFiltersProps) {
  const searchId = useId()
  const countryId = useId()
  const tierId = useId()
  const sportId = useId()
  const fromId = useId()
  const toId = useId()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const syncingFromUrl = useRef(false)

  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [country, setCountry] = useState(searchParams.get("country") ?? "")
  const [category, setTier] = useState<SportEventCategory | "">(
    (searchParams.get("category") as SportEventCategory | null) ?? "",
  )
  const [sport, setSport] = useState<SportDiscipline | "">(
    (searchParams.get("discipline") as SportDiscipline | null) ?? "",
  )
  const [from, setFrom] = useState(searchParams.get("from") ?? "")
  const [to, setTo] = useState(searchParams.get("to") ?? "")
  const [featured, setFeatured] = useState(searchParams.get("featured") === "true")
  const deferredQuery = useDeferredValue(query)

  const isTier = (value: string | null): value is SportEventCategory =>
    categoryOptions.some((option) => option.value === value)
  const isSport = (value: string | null): value is SportDiscipline =>
    sportOptions.some((option) => option.value === value)

  const emit = (next: {
    q: string
    country: string
    category: SportEventCategory | ""
    sport: SportDiscipline | ""
    from: string
    to: string
    featured: boolean
  }) => {
    const params = new URLSearchParams()
    if (next.q.trim()) params.set("q", next.q.trim())
    if (next.country.trim()) params.set("country", next.country.trim())
    if (next.category) params.set("category", next.category)
    if (next.sport) params.set("discipline", next.sport)
    if (next.from) params.set("from", next.from)
    if (next.to) params.set("to", next.to)
    if (next.featured) params.set("featured", "true")
    const queryString = params.toString()
    startTransition(() => {
      router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`, {
        scroll: false,
      })
    })
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      syncingFromUrl.current = true
      setQuery(searchParams.get("q") ?? "")
      setCountry(searchParams.get("country") ?? "")
      const nextTier = searchParams.get("category")
      const nextSport = searchParams.get("discipline")
      setTier(isTier(nextTier) ? nextTier : "")
      setSport(isSport(nextSport) ? nextSport : "")
      setFrom(searchParams.get("from") ?? "")
      setTo(searchParams.get("to") ?? "")
      setFeatured(searchParams.get("featured") === "true")
    })
    return () => cancelAnimationFrame(frame)
    // URL updates are the source of truth; option lists only validate values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sportOptions, categoryOptions])

  useEffect(() => {
    if (syncingFromUrl.current) {
      syncingFromUrl.current = false
      return
    }
    if (deferredQuery === (searchParams.get("q") ?? "")) return
    emit({ q: deferredQuery, country, category, sport, from, to, featured })
    // The URL is the source of truth for the current filters. This effect is
    // deliberately driven only by the deferred search value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredQuery])

  const hasFilters = Boolean(
    query || country || category || sport || from || to || featured,
  )

  const updateAndEmit = <K extends keyof Omit<Parameters<typeof emit>[0], "q">>(
    key: K,
    value: Parameters<typeof emit>[0][K],
  ) => {
    const next = { q: query, country, category, sport, from, to, featured, [key]: value }
    if (key === "country") setCountry(value as string)
    if (key === "category") setTier(value as SportEventCategory | "")
    if (key === "sport") setSport(value as SportDiscipline | "")
    if (key === "from") setFrom(value as string)
    if (key === "to") setTo(value as string)
    if (key === "featured") setFeatured(value as boolean)
    emit(next)
  }

  const clearFilters = () => {
    setQuery("")
    setCountry("")
    setTier("")
    setSport("")
    setFrom("")
    setTo("")
    setFeatured(false)
    emit({ q: "", country: "", category: "", sport: "", from: "", to: "", featured: false })
  }

  return (
    <div className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <div>
          <label
            htmlFor={searchId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Search events
          </label>
          <div className="relative">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, description, city, country…"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-3 pl-10 pr-3 text-base font-medium text-on-surface shadow-none focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor={countryId}
            className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
          >
            Country
          </label>
          <input
            id={countryId}
            type="text"
            value={country}
            onChange={(event) => updateAndEmit("country", event.target.value)}
            placeholder="e.g. France"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface shadow-none focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 sm:text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
          <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Sport
          </legend>
          <select
            id={sportId}
            aria-label="Sport"
            value={sport}
            onChange={(event) =>
              updateAndEmit("sport", event.target.value as SportDiscipline | "")
            }
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface focus:border-primary focus:outline-none sm:text-sm"
          >
            <option value="">All sports</option>
            {sportOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
          <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Tier
          </legend>
          <select
            id={tierId}
            aria-label="Tier"
            value={category}
            onChange={(event) =>
              updateAndEmit("category", event.target.value as SportEventCategory | "")
            }
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base font-medium text-on-surface focus:border-primary focus:outline-none sm:text-sm"
          >
            <option value="">All categories</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </fieldset>
      </div>

      <fieldset className="rounded-lg border border-outline-variant bg-surface-container-low p-3">
        <legend className="px-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          Date range
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={fromId} className="mb-1 block text-xs text-secondary">
              Starts on or after
            </label>
            <input
              id={fromId}
              type="date"
              value={from}
              onChange={(event) => updateAndEmit("from", event.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base text-on-surface focus:border-primary focus:outline-none sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor={toId} className="mb-1 block text-xs text-secondary">
              Ends on or before
            </label>
            <input
              id={toId}
              type="date"
              value={to}
              onChange={(event) => updateAndEmit("to", event.target.value)}
              className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-base text-on-surface focus:border-primary focus:outline-none sm:text-sm"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-11 items-center gap-3 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-sm font-medium text-on-surface">
          <input
            type="checkbox"
            checked={featured}
            onChange={(event) => updateAndEmit("featured", event.target.checked)}
            className="h-5 w-5 accent-primary"
          />
          Featured only
        </label>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]",
            )}
          >
            <X size={13} aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  )
}
