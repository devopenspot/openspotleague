import { LoaderCircle } from "lucide-react";
import { Overlay } from "@/components/feedback/Overlay";
import type { GameState } from "@/lib/schemas/game";

const STATUS_TITLE_ID = "game-board-action-status-title";

export function GameBoardActionStatusModal({
  isOpen,
  busy,
  locationPending,
  settingsModalOpen = false,
  game,
}: {
  isOpen: boolean;
  busy: boolean;
  locationPending: boolean;
  settingsModalOpen?: boolean;
  game: GameState;
}) {
  const currentStatus = game.currentRound?.status;
  const message = locationPending
    ? "Checking You In…"
    : currentStatus === "selecting_spot_type" ||
        currentStatus === "selecting_level" ||
        currentStatus === "no_compatible_trick"
      ? "Setting Your Next Trick…"
      : "Updating Your Session…";

  return (
    <Overlay
      isOpen={isOpen && !settingsModalOpen}
      onClose={() => undefined}
      labelledBy={STATUS_TITLE_ID}
      closeOnBackdrop={false}
      panelClassName="mx-5 w-[min(28rem,calc(100vw-2.5rem))] border border-outline-variant bg-surface-bright p-6"
    >
      <div
        className="flex items-start gap-4"
        aria-busy={busy || locationPending}
        role="status"
        aria-live="polite"
      >
        <LoaderCircle
          size={22}
          aria-hidden="true"
          className="mt-0.5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
        />
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
            Hang Tight
          </p>
          <h2
            id={STATUS_TITLE_ID}
            className="mt-2 font-display text-[32px] font-bold leading-[1.3]"
          >
            {message}
          </h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            Keep The App Open — We’re Syncing The Crew.
          </p>
        </div>
      </div>
    </Overlay>
  );
}
