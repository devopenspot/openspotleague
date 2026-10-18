"use client"

import { useEffect, useRef, useState } from "react"

export interface CountryOption {
  iso2: string
  name: string
  region: string
}

export interface UseCountriesResult {
  items: readonly CountryOption[]
  isLoading: boolean
  error: string | null
}

export interface UseCountriesOptions {
  debounceMs?: number
  minChars?: number
}

const DEFAULT_DEBOUNCE_MS = 200
const DEFAULT_MIN_CHARS = 1

function readErrorBody(
  body: { error?: string } | null,
  status: number,
): string {
  if (body?.error) return body.error
  if (status >= 500) return "Country lookup service is unavailable."
  return `Country lookup failed (${status})`
}

export function useCountries(
  query: string,
  options?: UseCountriesOptions,
): UseCountriesResult {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const minChars = options?.minChars ?? DEFAULT_MIN_CHARS
  const [items, setItems] = useState<readonly CountryOption[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Map<string, readonly CountryOption[]>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < minChars) {
      abortRef.current?.abort()
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems([])
      setIsLoading(false)
      setError(null)
      return
    }
    const key = trimmed.toLowerCase()
    const cached = cacheRef.current.get(key)
    if (cached) {
      abortRef.current?.abort()
      setItems(cached)
      setIsLoading(false)
      setError(null)
      return
    }
    setError(null)
    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setIsLoading(true)
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/countries?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
          )
          if (controller.signal.aborted) return
          if (!res.ok) {
            const body = (await res
              .json()
              .catch(() => null)) as { error?: string } | null
            setError(readErrorBody(body, res.status))
            setItems([])
            setIsLoading(false)
            return
          }
          const data = (await res.json()) as {
            items: readonly CountryOption[]
          }
          if (controller.signal.aborted) return
          cacheRef.current.set(key, data.items)
          setItems(data.items)
          setIsLoading(false)
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return
          if (controller.signal.aborted) return
          setError(
            err instanceof Error ? err.message : "Failed to load countries",
          )
          setItems([])
          setIsLoading(false)
        }
      })()
    }, debounceMs)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, debounceMs, minChars])

  return { items, isLoading, error }
}
