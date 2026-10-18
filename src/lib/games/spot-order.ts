import { haversineMeters } from "@/lib/spots/geo"

export type GameSpot = {
  id: string
  name: string
  city: string
  country: string
  types: readonly { slug: string; name: string }[]
  location: { lat: number; lon: number }
}

export type GroupedGameSpot = GameSpot & { distanceMeters: number | null }

export function groupSpotsByCountry(spots: readonly GameSpot[], location: { lat: number; lon: number } | null): readonly { country: string; spots: readonly GroupedGameSpot[] }[] {
  const groups = new Map<string, GroupedGameSpot[]>()
  for (const spot of spots) {
    const country = spot.country || "Other countries"
    const distanceMeters = location ? haversineMeters(location.lat, location.lon, spot.location.lat, spot.location.lon) : null
    const group = groups.get(country) ?? []
    group.push({ ...spot, distanceMeters })
    groups.set(country, group)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, group]) => ({
      country,
      spots: group.sort((a, b) => {
        if (a.distanceMeters === null || b.distanceMeters === null) return a.name.localeCompare(b.name)
        return a.distanceMeters - b.distanceMeters || a.name.localeCompare(b.name)
      }),
    }))
}
