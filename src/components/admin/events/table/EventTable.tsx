"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import {
  ArrowRight,
  CalendarDays,
  Instagram,
  MapPin,
  Pencil,
  Star,
  Trash2,
  Youtube,
} from "lucide-react"
import { DeleteConfirmDialog } from "@/components/admin/common/DeleteConfirmDialog"
import type { SportEvent } from "@/types/sport-events"
import { EVENT_CATEGORY_LABELS } from "../form/event-options"

interface EventTableProps {
  events: readonly SportEvent[]
  nextCursor: string | null
}

function socialLabel(value: string | null | undefined): string {
  if (!value) return "Not set"
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return value
  }
}

function eventStatus(event: SportEvent): "upcoming" | "live" | "completed" {
  const today = new Date().toISOString().slice(0, 10)
  if (event.endDate ? event.endDate < today : event.startDate < today) {
    return "completed"
  }
  if (event.startDate > today) return "upcoming"
  return "live"
}

function statusLabel(status: ReturnType<typeof eventStatus>): string {
  return status === "live"
    ? "Live"
    : status === "upcoming"
      ? "Upcoming"
      : "Completed"
}

export function EventTable({ events, nextCursor }: EventTableProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pendingDelete, setPendingDelete] = useState<SportEvent | null>(null)

  const nextPageParams = new URLSearchParams(searchParams.toString())
  if (nextCursor) nextPageParams.set("cursor", nextCursor)
  const nextPageHref = `${pathname}?${nextPageParams.toString()}`

  const handleDeleted = async () => {
    if (!pendingDelete) return
    const response = await fetch(
      `/api/admin/events/${encodeURIComponent(pendingDelete.id)}`,
      {
        method: "DELETE",
        headers: { "If-Match": `"${pendingDelete.updatedAt}"` },
      },
    )
    if (response.status === 401) {
      router.push("/login")
      throw new Error("Your session has expired. Sign in again to continue.")
    }
    if (!response.ok && response.status !== 204) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(body?.error ?? `Delete failed (${response.status}).`)
    }
    setPendingDelete(null)
    router.refresh()
  }

  if (events.length === 0) {
    return (
      <div
        role="status"
        className="rounded-lg border border-dashed border-outline-variant bg-surface-container-low p-10 text-center"
      >
        <p className="font-display text-lg font-bold tracking-tight text-on-surface">
          No events match these filters
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-secondary">
          Clear a filter or create the first event in this catalogue.
        </p>
        <Link
          href="/admin/events/new"
          className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]"
        >
          Create event
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest md:block">
        <table className="w-full min-w-[70rem] text-left text-sm">
          <caption className="sr-only">Administrative event catalogue</caption>
          <thead className="border-b border-outline-variant bg-surface-container-low font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
            <tr>
              <th scope="col" className="px-4 py-3">Event</th>
              <th scope="col" className="px-4 py-3">Place</th>
              <th scope="col" className="px-4 py-3">Tier</th>
              <th scope="col" className="px-4 py-3">Schedule</th>
              <th scope="col" className="px-4 py-3">Disciplines</th>
              <th scope="col" className="px-4 py-3">Socials</th>
              <th scope="col" className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {events.map((event) => {
              const status = eventStatus(event)
              return (
                <tr
                  key={event.id}
                  className="transition-colors hover:bg-surface-container-low"
                >
                  <td className="max-w-[18rem] px-4 py-4 align-top">
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="font-bold text-on-surface hover:underline focus:outline-none focus-visible:underline"
                    >
                      {event.name}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span
                        className={
                          status === "live"
                            ? "rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-on-primary"
                            : "rounded-md bg-surface-container-high px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
                        }
                      >
                        {statusLabel(status)}
                      </span>
                      {event.featured ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-on-primary">
                          <Star size={10} aria-hidden="true" />
                          Featured
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="max-w-[14rem] px-4 py-4 align-top text-secondary">
                    <div className="flex items-start gap-2">
                      <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span>
                        {event.location.city}, {event.location.country}
                        {event.location.venue ? (
                          <span className="mt-1 block text-xs text-on-surface-variant">
                            {event.location.venue}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                      {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="flex items-start gap-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary">
                      <CalendarDays size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                      <span>
                        <time dateTime={event.startDate}>{event.startDate}</time>
                        {event.endDate ? (
                          <>
                            <span aria-hidden="true"> → </span>
                            <time dateTime={event.endDate}>{event.endDate}</time>
                          </>
                        ) : null}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-[12rem] px-4 py-4 align-top">
                    {event.sports.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {event.sports.map((sport) => (
                          <span
                            key={sport}
                            className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 text-[10px] font-semibold text-secondary"
                          >
                            {sport}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-eyebrow text-secondary">
                        None
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <ul aria-label={`${event.name} social profiles`} className="space-y-2">
                      <li
                        className="flex items-center gap-1.5 text-xs text-secondary"
                        title={event.instagram ?? "Not set"}
                      >
                        <Instagram
                          size={13}
                          aria-hidden="true"
                          className={event.instagram ? "text-on-surface" : "text-outline"}
                        />
                        <span className="max-w-[9rem] truncate">{socialLabel(event.instagram)}</span>
                      </li>
                      <li
                        className="flex items-center gap-1.5 text-xs text-secondary"
                        title={event.youtube ?? "Not set"}
                      >
                        <Youtube
                          size={13}
                          aria-hidden="true"
                          className={event.youtube ? "text-on-surface" : "text-outline"}
                        />
                        <span className="max-w-[9rem] truncate">{socialLabel(event.youtube)}</span>
                      </li>
                    </ul>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:bg-surface-container-highest hover:text-on-surface active:scale-[0.99]"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(event)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-secondary transition-colors duration-150 ease-out hover:border-error hover:bg-error-container hover:text-error active:scale-[0.99]"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden" aria-label="Events list">
        {events.map((event) => {
          const status = eventStatus(event)
          return (
            <article
              key={event.id}
              className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="font-display text-lg font-bold text-on-surface hover:underline focus:outline-none focus-visible:underline"
                  >
                    {event.name}
                  </Link>
                  <p className="mt-1 text-sm text-secondary">
                    {event.location.city}, {event.location.country}
                  </p>
                </div>
                <span
                  className={
                    status === "live"
                      ? "shrink-0 rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-on-primary"
                      : "shrink-0 rounded-md bg-surface-container-high px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary"
                  }
                >
                  {statusLabel(status)}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-3 text-xs">
                <div>
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                    Dates
                  </dt>
                  <dd className="mt-1 text-on-surface">
                    <time dateTime={event.startDate}>{event.startDate}</time>
                    {event.endDate ? ` → ${event.endDate}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                    Tier
                  </dt>
                  <dd className="mt-1 text-on-surface">
                    {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {event.sports.map((sport) => (
                  <span
                    key={sport}
                    className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1 text-[10px] font-semibold text-secondary"
                  >
                    {sport}
                  </span>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href={`/admin/events/${event.id}`}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
                >
                  <Pencil size={13} aria-hidden="true" />
                  <span>Edit</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setPendingDelete(event)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-error px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-error transition-colors duration-150 ease-out hover:bg-error-container active:scale-[0.99]"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {nextCursor ? (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4">
          <p className="text-sm text-secondary">
            More events are available with these filters.
          </p>
          <Link
            href={nextPageHref}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99]"
          >
            Next page
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <DeleteConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleted}
        title="Delete event"
        description={
          pendingDelete
            ? `Delete "${pendingDelete.name}"? This cannot be undone.`
            : ""
        }
      />
    </>
  )
}
