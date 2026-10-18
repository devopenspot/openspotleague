"use client"

import { Check, MapPin } from "lucide-react"
import type { ProjectedAddress } from "@/lib/geocode/project"

interface NominatimAddressPreviewProps {
  address: ProjectedAddress
}

/**
 * Renders a stable, projected address returned by `/api/geocode/reverse`.
 * Shown under the lat/lon inputs once the admin clicks `Look up`. Pure
 * presentation — does not call the API itself.
 */
export function NominatimAddressPreview({ address }: NominatimAddressPreviewProps) {
  const composed = composeAddress(address)
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4"
    >
      <div className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">
        <Check size={12} aria-hidden="true" className="text-primary" />
        <span>Reverse-geocode result</span>
      </div>
      <p className="text-sm leading-6 text-on-surface">{composed}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-eyebrow text-secondary">
        <span className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-surface-container-low px-2 py-1">
          <MapPin size={10} aria-hidden="true" />
          {address.lat.toFixed(4)}, {address.lon.toFixed(4)}
        </span>
        {address.country ? (
          <span className="rounded-md border border-outline-variant bg-surface-container-low px-2 py-1">
            {address.country}
            {address.countryCode ? ` (${address.countryCode})` : ""}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function composeAddress(a: ProjectedAddress): string {
  const parts: string[] = []
  const line1 = [a.houseNumber, a.road].filter(Boolean).join(" ")
  if (line1) parts.push(line1)
  if (a.suburb) parts.push(a.suburb)
  if (a.city) parts.push(a.city)
  if (a.state) parts.push(a.state)
  if (a.country) parts.push(a.country)
  if (parts.length === 0) return a.displayName
  return parts.join(", ")
}
