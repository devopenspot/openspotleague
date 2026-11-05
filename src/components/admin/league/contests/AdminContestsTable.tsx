import Link from "next/link"
import { Star } from "lucide-react"
import { statusLabel } from "@/lib/league/ui-state"
import type { ContestCurationItem } from "@/lib/services/league"

function planLabel(slug: string): string {
  return `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`
}

export function AdminContestsTable({
  items,
  truncated,
}: {
  items: readonly ContestCurationItem[]
  truncated: boolean
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 text-sm text-secondary">
        No contests match these filters.
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant bg-surface-container-lowest">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">
          Contests{truncated ? " (first results only — refine the filters)" : ""}
        </caption>
        <thead className="border-b border-outline-variant bg-surface-container-low font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
          <tr>
            <th scope="col" className="px-4 py-3">Contest</th>
            <th scope="col" className="px-4 py-3">Where</th>
            <th scope="col" className="px-4 py-3">Starts</th>
            <th scope="col" className="px-4 py-3">Plan</th>
            <th scope="col" className="px-4 py-3">Listing</th>
            <th scope="col" className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-surface-container-low">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/league/contests/${item.id}`}
                  className="inline-flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface hover:underline"
                >
                  {item.featured ? (
                    <Star size={12} aria-label="Featured" className="text-on-surface" />
                  ) : null}
                  {item.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-secondary">
                {item.city}, {item.countryName}
              </td>
              <td className="px-4 py-3 tabular-nums text-secondary">{item.startDate}</td>
              <td className="px-4 py-3">
                {planLabel(item.planSlug)}
                <span className="block text-[10px] text-secondary">
                  {item.settled ? "Settled" : "Payment due"}
                </span>
              </td>
              <td className="px-4 py-3">{item.visibility === "public" ? "Public" : "Private"}</td>
              <td className="px-4 py-3">{statusLabel(item.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
