"use client";

export function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div role="alert" className="rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 text-center">
      <p className="font-mono text-xs uppercase">{error.message || "Something went wrong"}</p>
      <button type="button" onClick={resetErrorBoundary} className="mt-3 min-h-9 rounded-full bg-on-surface px-4 text-xs font-bold uppercase text-surface">
        Retry
      </button>
    </div>
  );
}
