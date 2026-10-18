"use client"

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="space-y-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-6" role="alert">
      <p className="font-mono text-[10px] font-bold uppercase tracking-eyebrow text-secondary">Admin data unavailable</p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-on-surface">Could not load this section</h1>
      <p className="max-w-xl text-sm leading-6 text-on-surface-variant">
        The database request did not finish. Check the connection and try again; no changes were made.
      </p>
      <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary px-5 py-2 font-display text-[11px] font-bold uppercase leading-none tracking-[0.08em] text-on-primary transition-colors duration-150 ease-out hover:bg-surface-tint active:scale-[0.99]">
        Try again
      </button>
    </section>
  )
}
