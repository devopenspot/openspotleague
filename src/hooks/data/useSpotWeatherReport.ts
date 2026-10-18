'use client'

import { useEffect, useState } from 'react'

export interface SpotWeatherReportClient {
  forecastIcon: string
  observedIcon: string
  confirmed: boolean
  createdAt: string
}

export function useSpotWeatherReport(spotId: string | null | undefined) {
  const [report, setReport] = useState<SpotWeatherReportClient | null>(null)

  useEffect(() => {
    if (!spotId) return
    let cancelled = false
    fetch(`/api/spots/${encodeURIComponent(spotId)}/weather-report`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { report: SpotWeatherReportClient | null }
        return data.report
      })
      .then((value) => {
        if (!cancelled) setReport(value)
      })
      .catch(() => {
        if (!cancelled) setReport(null)
      })
    return () => {
      cancelled = true
    }
  }, [spotId])

  return report
}
