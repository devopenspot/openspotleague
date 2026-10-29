"use client"

import { useEffect, type ReactNode } from "react"
import { usePreferencesStore } from "@/stores/preferences-store"
import { useUIStore } from "@/stores/ui-store"
import { useUser } from "@/lib/contexts/user-context"
import { fetchWithTimeout } from "@/lib/utils/fetch-timeout"
import type { DistanceUnit, TemperatureUnit } from "@/stores/preferences-store"
import { SPORT_DISCIPLINES, type SportPreference } from "@/types/sport-events"

export function HydrationGate({ children }: { children: ReactNode }) {
  const user = useUser()
  const userId = user?.id ?? null
  const setPreferences = usePreferencesStore((state) => state.setPreferences)
  const setHydrationStatus = usePreferencesStore((state) => state.setHydrationStatus)
  const resolvePendingOnboarding = useUIStore((state) => state.resolvePendingOnboarding)

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    const finish = (status: "ready" | "error") => {
      if (cancelled) return
      setHydrationStatus(status)
      resolvePendingOnboarding()
    }

    void (async () => {
      try {
        await usePreferencesStore.persist.rehydrate()
        if (cancelled) return
        setHydrationStatus("loading")
        if (!userId) {
          finish("ready")
          return
        }

        const response = await fetchWithTimeout("/api/preferences", {
          cache: "no-store",
          signal: abortController.signal,
          timeoutMs: 10_000,
        })
        if (!response.ok) throw new Error("Preferences unavailable")
        const data = await response.json() as {
          distanceUnit: DistanceUnit
          temperatureUnit: TemperatureUnit
          disciplineSlug: string | null
        }
        if (cancelled) return

        const local = usePreferencesStore.getState()
        const accountSport: SportPreference | null =
          data.disciplineSlug === "all"
            ? "all"
            : SPORT_DISCIPLINES.find(
                (sport) => sport.toLowerCase() === data.disciplineSlug,
              ) ?? null
        const shouldSyncGuest =
          local.preferenceAccountId === null && local.hasLocalChanges

        if (!accountSport && shouldSyncGuest) {
          const syncResponse = await fetchWithTimeout("/api/preferences", {
            method: "PATCH",
            cache: "no-store",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              distanceUnit: local.distanceUnit,
              temperatureUnit: local.temperatureUnit,
              disciplineSlug:
                local.preferredSport === "all"
                  ? "all"
                  : local.preferredSport?.toLowerCase() ?? null,
            }),
            signal: abortController.signal,
            timeoutMs: 10_000,
          })
          if (!syncResponse.ok) {
            throw new Error("Guest preferences could not be synced")
          }
          const synced = await syncResponse.json() as typeof data
          if (cancelled) return
          const syncedSport: SportPreference | null =
            synced.disciplineSlug === "all"
              ? "all"
              : SPORT_DISCIPLINES.find(
                  (sport) => sport.toLowerCase() === synced.disciplineSlug,
                ) ?? null
          setPreferences({
            distanceUnit: synced.distanceUnit,
            temperatureUnit: synced.temperatureUnit,
            preferredSport: syncedSport,
          }, { accountId: userId, hasLocalChanges: false })
        } else {
          setPreferences({
            distanceUnit: data.distanceUnit,
            temperatureUnit: data.temperatureUnit,
            preferredSport: accountSport,
          }, { accountId: userId, hasLocalChanges: false })
        }
        finish("ready")
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return
        finish("error")
      }
    })()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [resolvePendingOnboarding, setHydrationStatus, setPreferences, userId])

  return <>{children}</>
}
