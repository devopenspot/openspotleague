import Link from "next/link"
import { Bookmark, MapPin, Trophy } from "lucide-react"
import { SurfaceCard } from "@/components/ui"
import { getServerUserFromCookies } from "@/lib/auth/auth"
import { runListSpots } from "@/lib/services/spot/spots"
import { runListEventsRaw } from "@/lib/services/event/events"
import { runListSavedSpots } from "@/lib/services/spot/saved-spots"

interface OverviewCard {
  href: string
  label: string
  value: number
  hint: string
  Icon: typeof Bookmark
}

const COUNT_LIMIT = 500

export async function AdminOverviewCards() {
  const [user, spotsResult, eventsResult] = await Promise.all([
    getServerUserFromCookies(),
    runListSpots({ limit: COUNT_LIMIT }),
    runListEventsRaw({ limit: COUNT_LIMIT }),
  ])

  const savedResult = user
    ? await runListSavedSpots(user.id, { limit: COUNT_LIMIT })
    : { items: [], nextCursor: null }

  const cards: OverviewCard[] = [
    {
      href: "/admin/spots",
      label: "Total spots",
      value: spotsResult.items.length,
      hint: spotsResult.nextCursor
        ? `${spotsResult.items.length}+ — refine your search to count precisely`
        : "Curated spots across the network",
      Icon: MapPin,
    },
    {
      href: "/admin/events",
      label: "Total events",
      value: eventsResult.items.length,
      hint: eventsResult.nextCursor
        ? `${eventsResult.items.length}+ — refine your search to count precisely`
        : "Sport events on the circuit",
      Icon: Trophy,
    },
    {
      href: "/saved",
      label: "Your saved spots",
      value: savedResult.items.length,
      hint: "Spots you have bookmarked on this device",
      Icon: Bookmark,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.Icon
        return (
          <Link
            key={card.href}
            href={card.href}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <SurfaceCard className="h-full rounded-lg p-5 transition-colors group-hover:bg-surface-container-low">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
                  {card.label}
                </span>
                <Icon
                  size={16}
                  aria-hidden="true"
                  className="text-secondary"
                />
              </div>
              <div className="font-display text-4xl font-bold tracking-tight text-on-surface">
                {card.value.toLocaleString()}
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary">
                {card.hint}
              </p>
            </SurfaceCard>
          </Link>
        )
      })}
    </div>
  )
}
