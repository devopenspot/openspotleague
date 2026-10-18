"use client"

import { useEffect, useState } from "react"
import type { ProfileTricks } from "@/lib/services/profile/profile"

function LevelBar({ level, count, max }: { level: number; count: number; max: number }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-7 font-display text-[11px] font-bold uppercase tracking-widest text-secondary">L{level}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right font-display text-[13px] font-bold leading-none">{count}</span>
    </div>
  )
}

export function ProfileTricksPanel() {
  const [data, setData] = useState<ProfileTricks | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/profile/tricks", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed")
        return r.json() as Promise<ProfileTricks>
      })
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setError(true)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  if (loading) {
    return <ProfileTricksSkeleton />
  }
  if (error || !data) {
    return <p className="font-display text-[11px] uppercase tracking-widest text-secondary">Tricks unavailable right now</p>
  }

  const max = Math.max(1, data.byLevel[1], data.byLevel[2], data.byLevel[3])
  const total = data.totalLanded + data.totalFailed
  const successRate = total > 0 ? Math.round((data.totalLanded / total) * 100) : 0

  return (
    <div className="overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest">
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-[13px] font-bold uppercase tracking-tight">Tricks landed</h3>
          <span className="rounded-full bg-surface-container-high px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-secondary">
            {data.totalLanded} landed • {data.totalFailed} failed • {successRate}% success
          </span>
        </div>
        <div className="mt-3 space-y-2.5">
          <LevelBar level={1} count={data.byLevel[1]} max={max} />
          <LevelBar level={2} count={data.byLevel[2]} max={max} />
          <LevelBar level={3} count={data.byLevel[3]} max={max} />
        </div>
        <p className="mt-2.5 font-display text-[10px] uppercase tracking-widest text-secondary">L1 = 5 pts • L2 = 13 • L3 = 21 • Win bonus 34</p>
      </div>

      <div className="border-t border-outline-variant bg-surface-container-low/40 p-4">
        <h4 className="font-display text-[11px] font-semibold uppercase tracking-[0.06em] text-secondary">Recent landings</h4>
        {data.recent.length === 0 ? (
          <p className="mt-2.5 font-display text-[11px] uppercase tracking-widest text-secondary">No landings yet — land your first in a game</p>
        ) : (
          <ul className="mt-2.5 space-y-1.5">
            {data.recent.map((r, idx) => (
              <li key={`${r.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-[10px] border border-outline-variant bg-surface-container px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate font-display text-[13px] font-semibold leading-none">{r.name}</p>
                  <p className="mt-1 font-display text-[10px] uppercase tracking-widest text-secondary">Lvl {r.level} • {new Date(r.date).toLocaleDateString()}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-display text-[11px] font-bold text-on-primary">+{r.points}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ProfileTricksSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest animate-pulse">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="h-4 w-24 rounded bg-surface-container-high" />
          <div className="h-5 w-32 rounded-full bg-surface-container-high" />
        </div>
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-6 rounded bg-surface-container-high" />
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high" />
            <div className="h-3 w-6 rounded bg-surface-container-high" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-6 rounded bg-surface-container-high" />
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high" />
            <div className="h-3 w-6 rounded bg-surface-container-high" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-3 w-6 rounded bg-surface-container-high" />
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high" />
            <div className="h-3 w-6 rounded bg-surface-container-high" />
          </div>
        </div>
        <div className="mt-2.5 h-3 w-44 rounded bg-surface-container-high" />
      </div>
      <div className="border-t border-outline-variant bg-surface-container-low/40 p-4">
        <div className="h-3 w-28 rounded bg-surface-container-high" />
        <div className="mt-2.5 space-y-1.5">
          {Array.from({ length: compact ? 2 : 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-[10px] border border-outline-variant bg-surface-container px-2.5 py-2">
              <div className="space-y-1.5 flex-1">
                <div className="h-3 w-20 rounded bg-surface-container-high" />
                <div className="h-3 w-28 rounded bg-surface-container-high" />
              </div>
              <div className="h-5 w-10 rounded-full bg-surface-container-high" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
