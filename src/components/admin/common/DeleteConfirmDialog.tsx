"use client"

import { useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Overlay } from "@/components/feedback/Overlay"
import { showToast } from "@/hooks/ui/useToast"

interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  title: string
  description: string
  confirmLabel?: string
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
}: DeleteConfirmDialogProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = () => {
    setError(null)
    startTransition(async () => {
      try {
        await onConfirm()
        showToast("Deleted", "success")
        onClose()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Delete failed"
        setError(message)
        showToast(message, "error")
      }
    })
  }

  return (
    <Overlay
      isOpen={isOpen}
      onClose={onClose}
      labelledBy="delete-confirm-title"
      role="alertdialog"
      contentId="delete-confirm-panel"
    >
      <div
        id="delete-confirm-panel"
        className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6 shadow-none"
      >
        <div className="mb-4 flex items-center gap-2">
          <Trash2
            size={16}
            aria-hidden="true"
            className="text-error"
          />
          <h2
            id="delete-confirm-title"
            className="font-display text-base font-bold tracking-tight text-on-surface"
          >
            {title}
          </h2>
        </div>
        <p className="text-xs text-secondary leading-relaxed">{description}</p>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-card border border-error/40 bg-error-container px-3 py-2 text-xs text-on-error-container"
          >
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-1.5">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-error bg-error px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-error transition-colors duration-150 ease-out hover:bg-error/90 active:scale-[0.99] disabled:opacity-50"
          >
            {pending ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  )
}
