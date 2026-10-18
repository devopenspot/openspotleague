import Link from "next/link"
import {
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  ClipboardList,
  MapPin,
  Plus,
  Trophy,
  Tv,
} from "lucide-react"
import { connection } from "next/server"
import { getServerUserFromCookies } from "@/lib/auth/auth"
import { runListEventsRaw } from "@/lib/services/event/events"
import { runListSpots } from "@/lib/services/spot/spots"
import { runListCurrentTrickCatalogs } from "@/lib/services/taxonomy/trick-catalogs"
import { runListTvVideos } from "@/lib/services/tv/tv"

const COUNT_LIMIT = 500

function countLabel(value: number, hasMore: boolean): string {
  return hasMore ? `${value}+` : value.toLocaleString()
}

export async function AdminCurationHub({
  deniedPath,
}: {
  deniedPath?: string
}) {
  await connection()
  const user = await getServerUserFromCookies()
  const [spotsResult, eventsResult, catalogs, tvVideos] = await Promise.all([
    runListSpots({ limit: COUNT_LIMIT }),
    runListEventsRaw({ limit: COUNT_LIMIT }),
    runListCurrentTrickCatalogs(),
    runListTvVideos({}).catch(() => [] as unknown as readonly { id: string }[]),
  ])
  const canCurateSpots = Boolean(user?.isAdministrator || user?.canCurateSpots)
  const canCurateEvents = Boolean(user?.isAdministrator || user?.canCurateEvents)
  const canCurateTricks = Boolean(user?.isAdministrator || user?.canCurateTricks)
  const canCurateTv = Boolean(
    user?.isAdministrator || (user as unknown as { canCurateTv?: boolean })?.canCurateTv,
  )
  const canManageLeague = Boolean(
    user?.isAdministrator ||
      (user as unknown as { canManageLeague?: boolean })?.canManageLeague,
  )
  const trickCount = catalogs.reduce(
    (total, catalog) => total + catalog.tricks.length,
    0,
  )

  return (
    <section
      id="admin-curation"
      aria-labelledby="admin-curation-heading"
      className="space-y-8 animate-fade-in"
    >
      {deniedPath ? (
        <div
          role="alert"
          className="rounded-card border border-error/40 bg-error-container p-4 text-sm text-on-error-container"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-eyebrow">Administrator access required</p>
          <p className="mt-1 leading-6">
            That section is reserved for administrators. You can continue
            curating spots, events, and tricks here.
          </p>
        </div>
      ) : null}

      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-outline-variant pb-6">
        <div>
          <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Curation workspace
          </span>
          <h1
            id="admin-curation-heading"
            className="max-w-3xl font-display text-3xl font-bold tracking-[-0.02em] text-on-surface sm:text-4xl"
          >
            Keep the catalogue useful
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
            Update the places, calendar, and trick references riders use to plan
            their next session. Changes are reflected in public listings after
            they are saved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canCurateSpots ? (
            <Link
              href="/admin/spots/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
            >
              <Plus size={13} aria-hidden="true" />
              New spot
            </Link>
          ) : null}
          {canCurateEvents ? (
            <Link
              href="/admin/events/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
            >
              <Plus size={13} aria-hidden="true" />
              New event
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {canCurateSpots ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
            <dt className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              <MapPin size={14} aria-hidden="true" />
              Spots
            </dt>
            <dd className="mt-2 font-display text-3xl font-bold tracking-tight text-on-surface">
              {countLabel(spotsResult.items.length, Boolean(spotsResult.nextCursor))}
            </dd>
          </div>
        ) : null}
        {canCurateEvents ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
            <dt className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              <CalendarDays size={14} aria-hidden="true" />
              Events
            </dt>
            <dd className="mt-2 font-display text-3xl font-bold tracking-tight text-on-surface">
              {countLabel(eventsResult.items.length, eventsResult.hasMore)}
            </dd>
          </div>
        ) : null}
        {canCurateTricks ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
            <dt className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              <Trophy size={14} aria-hidden="true" />
              Tricks
            </dt>
            <dd className="mt-2 font-display text-3xl font-bold tracking-tight text-on-surface">
              {trickCount.toLocaleString()}
            </dd>
          </div>
        ) : null}
        {canCurateTv ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
            <dt className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
              <Tv size={14} aria-hidden="true" />
              TV
            </dt>
            <dd className="mt-2 font-display text-3xl font-bold tracking-tight text-on-surface">
              {(tvVideos as readonly unknown[]).length.toLocaleString()}
            </dd>
          </div>
        ) : null}
      </dl>

      <section aria-labelledby="admin-curation-areas-heading" className="space-y-4">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            Work areas
          </p>
          <h2
            id="admin-curation-areas-heading"
            className="mt-1 font-display text-xl font-bold tracking-tight text-on-surface"
          >
            Choose what needs attention
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {canCurateSpots ? (
            <HubLink
              href="/admin/spots"
              Icon={MapPin}
              label="Spots"
              description="Search by place, filter by sport and type, and keep location details accurate."
              count={countLabel(spotsResult.items.length, Boolean(spotsResult.nextCursor))}
            />
          ) : null}
          {canCurateEvents ? (
            <HubLink
              href="/admin/events"
              Icon={CalendarDays}
              label="Events"
              description="Maintain the calendar, dates, tiers, locations, and featured listings."
              count={countLabel(eventsResult.items.length, eventsResult.hasMore)}
            />
          ) : null}
          {canCurateTricks ? (
            <HubLink
              href="/admin/taxonomy/tricks"
              Icon={Trophy}
              label="Tricks"
              description="Edit supported sport catalogs. Existing games keep their immutable snapshots."
              count={`${catalogs.length} catalog${catalogs.length === 1 ? "" : "s"}`}
            />
          ) : null}
          {canCurateTv ? (
            <HubLink
              href="/admin/tv"
              Icon={Tv}
              label="TV"
              description="Curate YouTube videos by discipline and category — public at /tv, iframe-ready."
              count={`${(tvVideos as readonly unknown[]).length} video${(tvVideos as readonly unknown[]).length === 1 ? "" : "s"}`}
            />
          ) : null}
          {canManageLeague ? (
            <HubLink
              href="/admin/league/payments"
              Icon={BadgeDollarSign}
              label="League"
              description="Payment queue, plan pricing and account-plan grants for community sport events."
              count="Payments · plans"
            />
          ) : null}
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface-variant">
        <ClipboardList size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-on-surface" />
        <p className="leading-6">
          Trick edits apply to future games and catalogs. Games already in
          progress retain the trick snapshot they started with.
        </p>
      </aside>
    </section>
  )
}

function HubLink({
  href,
  Icon,
  label,
  description,
  count,
}: {
  href: string
  Icon: typeof MapPin
  label: string
  description: string
  count: string
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4"
    >
      <article className="h-full rounded-lg border border-outline-variant bg-surface-container-lowest p-5 transition-colors group-hover:bg-surface-container-low">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-container-high text-on-surface">
            <Icon size={18} aria-hidden="true" />
          </span>
          <ArrowUpRight
            size={18}
            aria-hidden="true"
            className="text-secondary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </div>
        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight text-on-surface">{label}</h3>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
          </div>
          <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            {count}
          </span>
        </div>
      </article>
    </Link>
  )
}
