"use client"

interface EventFormSubmitProps {
  pending: boolean
  onCancel: () => void
  label: string
  pendingLabel: string
}

export function EventFormSubmit({
  pending,
  onCancel,
  label,
  pendingLabel,
}: EventFormSubmitProps) {
  return (
    <div
      className="flex justify-end gap-3 border-t border-outline-variant pt-6 max-sm:flex-col-reverse"
      aria-busy={pending}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-surface transition-colors duration-150 ease-out hover:bg-surface-container-highest active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? pendingLabel : label}
      </button>
    </div>
  )
}
