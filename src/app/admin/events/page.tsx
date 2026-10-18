import Link from "next/link"
import { Plus } from "lucide-react"
import { connection } from "next/server"
import { requireEventCurationRoleOrRedirect } from "@/lib/auth/server"
import { runListEventsRaw } from "@/lib/services/event/events"
import { runListAdminTaxonomy } from "@/lib/services/taxonomy/taxonomy"
import { toEventCategoryOptions, toSportOptions } from "@/lib/admin/taxonomy"
import { EventTable } from "@/components/admin/events/table/EventTable"
import { EventTableFilters } from "@/components/admin/events/table/EventTableFilters"
import {
  CalendarDateSchema,
  SportDisciplineSchema,
  SportEventCategorySchema,
} from "@/lib/schemas/event"

interface AdminEventsPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    country?: string
    discipline?: string
    cursor?: string
    featured?: string
    from?: string
    to?: string
  }>
}

export const metadata = {
  title: "Admin · Events",
}

function parseEnumParam<T extends string>(
  value: string | undefined,
  parse: { safeParse: (input: unknown) => { success: boolean; data?: T } },
): T | undefined {
  if (!value) return undefined
  const result = parse.safeParse(value)
  return result.success ? result.data : undefined
}

export default async function AdminEventsPage({ searchParams }: AdminEventsPageProps) {
  await connection()
  await requireEventCurationRoleOrRedirect("/admin/events")
  const params = await searchParams
  const q = (params.q ?? "").trim()
  const country = (params.country ?? "").trim()
  const category = parseEnumParam(params.category, SportEventCategorySchema)
  const discipline = parseEnumParam(params.discipline, SportDisciplineSchema)
  const cursor = (params.cursor ?? "").trim() || undefined
  const from = parseEnumParam(params.from, CalendarDateSchema)
  const to = parseEnumParam(params.to, CalendarDateSchema)
  const featured = params.featured === "true" ? true : undefined

  const resultPromise = runListEventsRaw({
    q: q || undefined,
    category,
    country: country || undefined,
    discipline,
    featured,
    from,
    to,
    cursor,
    limit: 100,
  })
  const taxonomyPromise = runListAdminTaxonomy()
  const [result, taxonomy] = await Promise.all([resultPromise, taxonomyPromise])

  return (
    <section
      id="admin-events"
      aria-labelledby="admin-events-heading"
      className="space-y-6 animate-fade-in"
    >
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Circuit
          </span>
          <h1
            id="admin-events-heading"
            className="font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl"
          >
            Events
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            {result.items.length} shown{result.hasMore ? "+" : ""}.
          </p>
        </div>
        <Link
          href="/admin/events/new"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
        >
          <Plus size={13} aria-hidden="true" />
          New event
        </Link>
      </header>

      <EventTableFilters
        sportOptions={toSportOptions(taxonomy.sports)}
        categoryOptions={toEventCategoryOptions(taxonomy.eventCategories)}
      />
      <EventTable events={result.items} nextCursor={result.nextCursor} />
    </section>
  )
}
