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

function applyVerificationCount(spotId: string, nextCount: number): void {
  const {
    spots,
    countrySpots,
    citySpots,
    nearbySpots,
    cityRadiusSpots,
    setSpots,
    setCountrySpots,
    setCitySpots,
    setNearbySpots,
    setCityRadiusSpots,
  } = useSpotsStore.getState()
  // Bump the base directory first; the mirrored overlay slices
  // (country-, city-, nearby- and city-radius-only spots) live outside
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
    return
  }
  if (cityRadiusSpots.some((s) => s.id === spotId)) {
    setCityRadiusSpots(
      cityRadiusSpots.map((s) => (s.id === spotId ? { ...s, verificationCount: nextCount } : s)),
    )
  }
}

export function useWeatherVerification(spotId: string | null) {
  const [state, setState] = useState<FetchState>({ summary: null, loading: false, error: null })
  const [verifying, setVerifying] = useState(false)

  const fetchSummary = useCallback(async (id: string) => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch(`/api/spot-verifications?spotId=${encodeURIComponent(id)}`)
      const body = (await res.json().catch(() => null)) as
        | { weather?: WeatherVerificationSummary; error?: string }
        | null
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`)
      setState({ summary: body?.weather ?? null, loading: false, error: null })
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
    void fetchSummary(spotId)
    // poll every 60s to handle TTL expiry
    const interval = window.setInterval(() => void fetchSummary(spotId), 60_000)
    return () => window.clearInterval(interval)
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
      // Optimistic bump only if not already verified? We don't know isVerified without extra fetch.
      // We fetch isVerified via GET we already have? Use count bump optimistic +1 and revert on error if server says alreadyVerified.
      // For now optimistic +1 if we assume not yet verified; server count will correct.
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
        if (body?.weather) setState((s) => ({ ...s, summary: body.weather ?? s.summary }))
        else await fetchSummary(spotId)
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
