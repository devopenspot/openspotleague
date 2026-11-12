"use client"

import { useState } from "react"
import type { FlagState } from "@/lib/services/flags/feature-flags"
import { CARD, CARD_TITLE, EYEBROW, INPUT, controlClass, tagClass } from "@/components/ui/recipes"

type Mode = "default" | "off" | "on"

interface Draft {
  mode: Mode
  rolloutPercent: number
  adminsOnly: boolean
}

function draftFrom(flag: FlagState): Draft {
  if (!flag.override) return { mode: "default", rolloutPercent: 100, adminsOnly: false }
  return {
    mode: flag.override.enabled ? "on" : "off",
    rolloutPercent: flag.override.rolloutPercent,
    adminsOnly: flag.override.allowRoles.includes("admin") && flag.override.rolloutPercent === 0,
  }
}

function summary(flag: FlagState): string {
  const o = flag.override
  if (!o) return `Default: ${flag.defaultEnabled ? "on" : "off"}`
  if (!o.enabled) return "Off for everyone"
  const parts: string[] = []
  if (o.allowRoles.length) parts.push(`roles ${o.allowRoles.join(", ")}`)
  if (o.allowUserIds.length) parts.push(`${o.allowUserIds.length} user(s)`)
  parts.push(`${o.rolloutPercent}% of signed-in users`)
  return `On for ${parts.join(" + ")}`
}

function FlagRow({ initial }: { initial: FlagState }) {
  const [flag, setFlag] = useState(initial)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial))
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle")
  const [message, setMessage] = useState<string | null>(null)

  async function save() {
    setStatus("saving")
    setMessage(null)
    try {
      const url = `/api/admin/flags/${encodeURIComponent(flag.key)}`
      if (draft.mode === "default") {
        const res = await fetch(url, { method: "DELETE" })
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `HTTP ${res.status}`)
        setFlag({ ...flag, override: null })
      } else {
        const body = {
          enabled: draft.mode === "on",
          rolloutPercent: draft.adminsOnly ? 0 : draft.rolloutPercent,
          allowUserIds: flag.override?.allowUserIds ?? [],
          allowRoles: draft.adminsOnly ? ["admin"] : [],
        }
        const res = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`)
        setFlag({
          ...flag,
          override: { ...body, updatedBy: null, updatedAt: json?.updatedAt ?? new Date().toISOString() },
        })
      }
      setStatus("idle")
      setMessage("Saved. Live within a minute.")
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Could not save")
    }
  }

  const expired = flag.removeBy < new Date().toISOString().slice(0, 10)

  return (
    <li className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className={`${CARD_TITLE} break-all text-on-surface`}>{flag.key}</h2>
          <p className="text-sm text-on-surface-variant">{flag.description}</p>
          <p className={EYEBROW}>
            Owner {flag.owner} · remove by {flag.removeBy}
          </p>
        </div>
        <span className={tagClass(flag.override ? "solid" : "outline")}>{summary(flag)}</span>
      </div>

      <fieldset className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,8rem)_auto_auto] sm:items-end">
        <legend className="sr-only">Override for {flag.key}</legend>
        <label className="space-y-1">
          <span className={EYEBROW}>State</span>
          <select
            className={INPUT}
            value={draft.mode}
            onChange={(e) => setDraft({ ...draft, mode: e.target.value as Mode })}
          >
            <option value="default">Code default ({flag.defaultEnabled ? "on" : "off"})</option>
            <option value="on">On</option>
            <option value="off">Off (kill switch)</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className={EYEBROW}>Rollout %</span>
          <input
            className={INPUT}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={5}
            disabled={draft.mode !== "on" || draft.adminsOnly}
            value={draft.rolloutPercent}
            onChange={(e) =>
              setDraft({ ...draft, rolloutPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
            }
          />
        </label>
        <label className="flex min-h-control items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            className="size-4"
            disabled={draft.mode !== "on"}
            checked={draft.adminsOnly}
            onChange={(e) => setDraft({ ...draft, adminsOnly: e.target.checked })}
          />
          Admins only
        </label>
        <button type="button" className={controlClass("primary")} disabled={status === "saving"} onClick={save}>
          {status === "saving" ? "Saving" : "Save"}
        </button>
      </fieldset>

      {expired && (
        <p className="mt-3 text-sm text-error">Past its remove-by date: finish the rollout and delete this flag.</p>
      )}
      {message && (
        <p role="status" className={`mt-3 text-sm ${status === "error" ? "text-error" : "text-on-surface-variant"}`}>
          {message}
        </p>
      )}
    </li>
  )
}

export function FlagManager({ initialFlags }: { initialFlags: FlagState[] }) {
  if (initialFlags.length === 0) {
    return (
      <div className={CARD}>
        <p className="text-sm text-on-surface-variant">
          No feature flags are declared. Add one in <code>src/lib/flags/registry.ts</code> when a big feature needs it.
        </p>
      </div>
    )
  }
  return (
    <ul className="space-y-4">
      {initialFlags.map((flag) => (
        <FlagRow key={flag.key} initial={flag} />
      ))}
    </ul>
  )
}
