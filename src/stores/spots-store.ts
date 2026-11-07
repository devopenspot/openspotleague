import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { MapSpot, Region, SpotTypeEntity } from "@/lib/types"

interface SpotsState {
  /**
   * Map-route working set of spot rows, hydrated by `MapProvider`
   * (map layout). The root layout no longer hydrates spot rows for
   * every page — spot features outside /map fetch DB truth
   * server-side (suggested spots, explore counters) or via the
   * public API (search overlay text search).
   */
  spots: readonly MapSpot[]
  regions: readonly Region[]
  spotTypes: readonly SpotTypeEntity[]
  /**
   * Full server-fetched spot list of the country currently filtered on
   * the map (`/map?country=<slug>`), outside the `SPOT_LIST_HARD_CAP`
   * base directory. Mirrored from the map page by `MapPageClient`.
   * Consumers needing the union (e.g. MapInfoPopup lookups by the
   * active pin) should combine both slices.
   */
  countrySpots: readonly MapSpot[]
  /**
   * Full server-fetched spot list of the city currently filtered on
   * the map (`&city=<slug>`), including spots within the 28km city
   * radius scope. Derived from `countrySpots` on the client when
   * `countrySpots` succeeds, or delivered from the server when a city
   * scope is active.
   */
  citySpots: readonly MapSpot[]
  /**
   * Spots within the maximum Nearby radius of the user's granted
   * position, fetched client-side by `useNearbySpots`
   * (`GET /api/spots?near=…`, cursor-walked) when Nearby mode
   * activates. Outside the `SPOT_LIST_HARD_CAP` directory, so
   * consumers needing the union must combine slices the same way the
   * `countrySpots`/`citySpots` overlays do. Nearby mode only: filtered
   * and saved mode never read this slice.
   */
  nearbySpots: readonly MapSpot[]
  /**
   * Spots around the map's focused spot ("View on map" deep link,
   * `/map?…&spot=<id>&around=<miles>`), walked by `useSpotAreaSpots` and
   * mirrored here by `MapTab` so MapInfoPopup / useWeatherVerification can
   * resolve pins outside the capped directory and country list. Empty
   * outside focus mode; independent of `nearbySpots`.
   */
  areaSpots: readonly MapSpot[]
  /**
   * True while a committed city-scope change (`city` URL param change in
   * `useMapFilter.writeQuery`) is in flight: the RSC navigation refetches
   * the full scope and the store still holds the previous city's data.
   * `MapPageClient` clears it when the new payload is mirrored. Search
   * overlay and map canvas read it to show the city loading state.
   */
  cityScopeLoading: boolean
  setCityScopeLoading: (loading: boolean) => void
  setMapData: (data: {
    spots: readonly MapSpot[]
    regions: readonly Region[]
    spotTypes: readonly SpotTypeEntity[]
  }) => void
  setSpots: (spots: readonly MapSpot[]) => void
  setRegions: (regions: readonly Region[]) => void
  setSpotTypes: (spotTypes: readonly SpotTypeEntity[]) => void
  setCountrySpots: (spots: readonly MapSpot[]) => void
  setCitySpots: (spots: readonly MapSpot[]) => void
  setNearbySpots: (spots: readonly MapSpot[]) => void
  setAreaSpots: (spots: readonly MapSpot[]) => void
}

export const CITY_SCOPE_LOADING_TIMEOUT_MS = 6_000
let cityScopeLoadingTimer: ReturnType<typeof setTimeout> | null = null

export const useSpotsStore = create<SpotsState>()(
  devtools(
    (set) => ({
      spots: [],
      regions: [],
      spotTypes: [],
      countrySpots: [],
      citySpots: [],
      nearbySpots: [],
      areaSpots: [],
      cityScopeLoading: false,
      setMapData: ({ spots, regions, spotTypes }) =>
        set({ spots, regions, spotTypes }),
      setSpots: (spots) => set({ spots }),
      setRegions: (regions) => set({ regions }),
      setSpotTypes: (spotTypes) => set({ spotTypes }),
      setCountrySpots: (countrySpots) => set({ countrySpots }),
      setCitySpots: (citySpots) => set({ citySpots }),
      setNearbySpots: (nearbySpots) => set({ nearbySpots }),
      setAreaSpots: (areaSpots) => set({ areaSpots }),
      setCityScopeLoading: (cityScopeLoading) => {
        if (cityScopeLoadingTimer !== null) {
          clearTimeout(cityScopeLoadingTimer)
          cityScopeLoadingTimer = null
        }
        set({ cityScopeLoading })
        if (cityScopeLoading) {
          cityScopeLoadingTimer = setTimeout(() => {
            cityScopeLoadingTimer = null
            set({ cityScopeLoading: false })
          }, CITY_SCOPE_LOADING_TIMEOUT_MS)
        }
      },
    }),
    { name: "SpotsStore", enabled: process.env.NODE_ENV === "development" },
  ),
)
