"use client";

type GuestJoinFormProps = {
  inputId: string;
  guestName: string;
  guestJoinError?: string | null;
  busy?: boolean;
  showError?: boolean;
  /** `large` is the outdoor game-sheet size. */
  size?: "default" | "large";
  /** Off when the submit action lives somewhere else, like the sheet footer. */
  showSubmit?: boolean;
  onGuestNameChange: (name: string) => void;
  onGuestJoin: () => void;
  className?: string;
};

export function GuestJoinForm({
  inputId,
  guestName,
  guestJoinError = null,
  busy = false,
  showError = true,
  size = "default",
  showSubmit = true,
  onGuestNameChange,
  onGuestJoin,
  className = "flex w-full flex-wrap gap-1.5",
}: GuestJoinFormProps) {
  const visibleError = showError ? guestJoinError : null;
  const errorId = `${inputId}-error`;

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        onGuestJoin();
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Pick A Rider Name
      </label>
      <input
        id={inputId}
        type="text"
        value={guestName}
        onChange={(event) => onGuestNameChange(event.target.value)}
        maxLength={30}
        placeholder="Pick A Rider Name"
        aria-invalid={visibleError ? "true" : undefined}
        aria-describedby={visibleError ? errorId : undefined}
        autoComplete="nickname"
        className={`min-w-0 flex-1 outline-none placeholder:text-secondary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 aria-[invalid=true]:border-error aria-[invalid=true]:bg-error-container ${size === "large" ? "min-h-12 rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 text-base" : "min-h-9 rounded-full border border-transparent bg-surface-container-low px-3 text-base sm:min-h-9 sm:text-sm"}`}
      />
      {showSubmit ? (
        <button
          type="submit"
          disabled={busy}
          className="min-h-9 shrink-0 rounded-full bg-primary px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-on-primary transition-[background-color,transform] hover:bg-primary/90 focus-visible:outline-offset-4 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join"}
        </button>
      ) : null}
      {visibleError ? (
        <p
          id={errorId}
          role="alert"
          className={`w-full rounded-[12px] bg-error-container px-3 py-1.5 font-semibold text-on-error-container ${size === "large" ? "text-sm" : "text-[11px] uppercase tracking-[0.04em]"}`}
        >
          {visibleError}
        </p>
      ) : null}
    </form>
  );
}
