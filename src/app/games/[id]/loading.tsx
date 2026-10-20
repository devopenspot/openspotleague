export default function GameBoardLoading() {
  return (
    <div
      role="status"
      aria-label="Loading game board"
      aria-busy="true"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4 lg:px-10 lg:pb-4"
    >
      {/* Top control deck placeholder */}
      <div className="flex h-12 items-center justify-between py-2" aria-hidden="true">
        <div className="h-9 w-32 animate-pulse rounded-full bg-surface-container-high" />
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-full bg-surface-container-high" />
          <div className="h-9 w-20 animate-pulse rounded-full bg-surface-container-high" />
        </div>
      </div>

      {/* Main arcade CRT bezel container */}
      <div className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col overflow-hidden pt-2" aria-hidden="true">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest p-2">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[12px] bg-surface-container">
            <div className="h-8 w-36 animate-pulse rounded-full bg-surface-container-highest" />
          </div>
        </div>
      </div>
    </div>
  );
}
