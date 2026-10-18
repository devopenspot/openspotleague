"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { showToast } from "@/hooks/ui/useToast"
import type { SpotFormState } from "./SpotFormFields"

interface SpotFormSubmitProps {
  state: SpotFormState
  /** Build the FormData payload for the action. */
  buildFormData: (state: SpotFormState) => FormData
  /** Server action (create or update). */
  action: (formData: FormData) => Promise<unknown>
  /** Path to navigate to on success (typically the edit page). */
  redirectTo: (result: { id: string }) => string
  /** Button label, e.g. "Register Spot" / "Save changes". */
  label: string
  /** Pending label, e.g. "Registering…" / "Saving…". */
  pendingLabel: string
  /** Disable submission (e.g. in JSON mode). */
  disabled?: boolean
  onSuccess?: () => void
}

export function SpotFormSubmit({
  state,
  buildFormData,
  action,
  redirectTo,
  label,
  pendingLabel,
  disabled = false,
  onSuccess,
}: SpotFormSubmitProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!state.name || !state.city || !state.countryCode || state.types.length === 0 || state.sports.length === 0 || !Number.isFinite(state.lat) || !Number.isFinite(state.lon)) {
      showToast("Name, city, country, sport, spot type, and coordinates are required", "error")
      return
    }
    const formData = buildFormData(state)
    startTransition(async () => {
      try {
        const result = (await action(formData)) as { id: string }
        showToast("Saved", "success")
        onSuccess?.()
        router.push(redirectTo(result))
        router.refresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Save failed"
        showToast(message, "error")
      }
    })
  }

  return (
    <div
      className="flex justify-end gap-2 border-t border-outline-variant pt-5"
      aria-busy={pending}
    >
      <button
        type="button"
        onClick={() => router.push("/admin/spots")}
        disabled={pending}
        className="rounded-md border border-outline bg-surface-container-high px-6 py-3 font-sans text-xs font-bold uppercase tracking-widest text-on-surface transition-all hover:bg-surface-container-highest disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending || disabled}
        onClick={handleSubmit}
        title={disabled ? "DB mode required" : undefined}
        className="rounded-md border border-primary bg-primary px-8 py-3 font-sans text-xs font-bold uppercase tracking-widest text-on-primary transition-all hover:bg-surface-tint disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {pending ? pendingLabel : label}
      </button>
    </div>
  )
}
