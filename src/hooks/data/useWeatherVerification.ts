"use client"
/* eslint-disable react-hooks/set-state-in-effect -- intentional reset on spot change + fetch */

import { useCallback, useEffect, useState } from "react"
import { showToast } from "@/hooks/ui/useToast"
import { useSpotsStore } from "@/stores/spots-store"
import type { WeatherVerificationSummary } from "@/lib/repositories/spot/weather-verification-repository"

type FetchState = {
  summary: WeatherVerificationSummary | null
  loading: boolean
  error: string | null
}

const summaryCache = new Map<string, WeatherVerificationSummary | null>()
const inflight = new Map<string, Promise<WeatherVerificationSummary | null>>()
const subscribers = new Map<string, Set<(summary: WeatherVerificationSummary | null) => void>>()

function notifySubscribers(spotId: string, summary: WeatherVerificationSummary | null): void {
  const set = subscribers.get(spotId)
  if (set) {
    for (const callback of set) {
      callback(summary)
    }
  }
}

async function fetchWeatherVerificationSummary(spotId: string): Promise<WeatherVerificationSummary | null> {
  const existing = inflight.get(spotId)
  if (existing) return existing

  const promise = (async () => {
    const res = await fetch(`/api/spot-verifications?spotId=${encodeURIComponent(spotId)}`)
    const body = (await res.json().catch(() => null)) as
      | { weather?: WeatherVerificationSummary; error?: string }
      | null
    if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
    const summary = body?.weather ?? null
    summaryCache.set(spotId, summary)
    notifySubscribers(spotId, summary)
    return summary
  })().finally(() => {
    inflight.delete(spotId)
  })

  inflight.set(spotId, promise)
  return promise
}

function applyVerificationCount(spotId: string, nextCount: number): void {
  const {
    spots,
    countrySpots,
    citySpots,
    nearbySpots,
    setSpots,
    setCountrySpots,
    setCitySpots,
    setNearbySpots,
  } = useSpotsStore.getState()
  // Bump the base directory first; the mirrored overlay slices
  // (country-, city-, and nearby-only spots) live outside
  // SPOT_LIST_HARD_CAP.
  const baseIndex = spots.findIndex((s) => s.id === spotId)
  if (baseIndex !== -1) {
    const next = spots.map((s) => (s.id === spotId ? { ...s, verificationCount: nextCount } : s))
    setSpots(next)
    return
  }
  if (countrySpots.some((s) => s.id === spotId)) {
    setCountrySpots(
      countrySpots.map((s) => (s.id === spotId ? { ...s, verificationCount: nextCount } : s)),
    )
    return
  }
  if (citySpots.some((s) => s.id === spotId)) {
    setCitySpots(
      citySpots.map((s) => (s.id === spotId ? { ...s, verificationCount: nextCount } : s)),
    )
    return
  }
  if (nearbySpots.some((s) => s.id === spotId)) {
    setNearbySpots(
      nearbySpots.map((s) => (s.id === spotId ? { ...s, verificationCount: nextCount } : s)),
    )
  }
}

export function useWeatherVerification(spotId: string | null) {
  const [state, setState] = useState<FetchState>(() => ({
    summary: spotId ? (summaryCache.get(spotId) ?? null) : null,
    loading: false,
    error: null,
  }))
  const [verifying, setVerifying] = useState(false)

  const fetchSummary = useCallback(async (id: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const summary = await fetchWeatherVerificationSummary(id)
      setState({ summary, loading: false, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load"
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [])

  useEffect(() => {
    if (!spotId) {
      setState({ summary: null, loading: false, error: null })
      return
    }

    // Subscribe to cross-component updates for this spot
    let subs = subscribers.get(spotId)
    if (!subs) {
      subs = new Set()
      subscribers.set(spotId, subs)
    }
    const onUpdate = (nextSummary: WeatherVerificationSummary | null) => {
      setState((s) => ({ ...s, summary: nextSummary, error: null }))
    }
    subs.add(onUpdate)

    // Sync initial state if available in cache or fetch
    if (summaryCache.has(spotId)) {
      setState((s) => ({ ...s, summary: summaryCache.get(spotId) ?? null }))
    } else {
      void fetchSummary(spotId)
    }

    // Poll every 60s to handle TTL expiry
    const interval = window.setInterval(() => {
      void fetchWeatherVerificationSummary(spotId)
    }, 60_000)

    return () => {
      subs?.delete(onUpdate)
      if (subs && subs.size === 0) {
        subscribers.delete(spotId)
      }
      window.clearInterval(interval)
    }
  }, [spotId, fetchSummary])

  const verify = useCallback(
    async (params: {
      latitude: number
      longitude: number
      accuracyMeters?: number | null
      voteIcon: string
    }) => {
      if (!spotId) throw new Error("Missing spotId")
      setVerifying(true)
      const current = useSpotsStore.getState().spots.find((s) => s.id === spotId)
      const prevCount = current?.verificationCount
      let optimisticApplied = false
      if (prevCount !== undefined) {
        applyVerificationCount(spotId, prevCount + 1)
        optimisticApplied = true
      }
      try {
        const res = await fetch("/api/spot-verifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spotId, ...params }),
        })
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; count?: number; weather?: WeatherVerificationSummary; error?: string; reason?: string }
          | null
        if (!res.ok) {
          throw new Error(body?.error ?? `HTTP ${res.status}`)
        }
        if (typeof body?.count === "number") applyVerificationCount(spotId, body.count)
        else if (optimisticApplied && prevCount !== undefined) applyVerificationCount(spotId, prevCount + 1)

        if (body?.weather) {
          summaryCache.set(spotId, body.weather)
          notifySubscribers(spotId, body.weather)
          setState((s) => ({ ...s, summary: body.weather ?? s.summary }))
        } else {
          await fetchSummary(spotId)
        }
        showToast("Verified spot & weather", "success", { title: "Verification" })
        return body
      } catch (err) {
        if (optimisticApplied && prevCount !== undefined) applyVerificationCount(spotId, prevCount)
        const msg = err instanceof Error ? err.message : "Verify failed"
        showToast(msg.includes("Too many") ? msg : `Could not verify: ${msg}`, "error")
        throw err
      } finally {
        setVerifying(false)
      }
    },
    [spotId, fetchSummary],
  )

  return {
    summary: state.summary,
    loading: state.loading,
    error: state.error,
    verifying,
    verify,
    refresh: spotId ? () => fetchSummary(spotId) : () => {},
  } as const
}
