"use client";

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronUp, Flag } from "lucide-react";
import { useRef, useState } from "react";
import type { GameState } from "@/lib/schemas/game";
import { useBodyScrollLock } from "@/hooks/ui/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/ui/useFocusTrap";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import {
  resolveChallengeSheetState,
  type ChallengeSheetState,
} from "@/lib/games/challenge-board-sheet";
import { ChallengeRiderTracksContent } from "@/components/games/board/ChallengeRiderTracks";

const SHEET_ID = "challenge-rider-tracks-sheet";
const SHEET_TITLE_ID = "challenge-rider-tracks-sheet-title";

export function ChallengeRiderTracksSheet({
  game,
}: {
  game: GameState;
}) {
  const [sheetState, setSheetState] = useState<ChallengeSheetState>("collapsed");
  const panelRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  const isExpanded = sheetState === "expanded";

  useBodyScrollLock(isExpanded);
  useFocusTrap(panelRef, isExpanded);
  useKeyboardShortcuts(
    isExpanded
      ? [{ key: "Escape", handler: () => setSheetState("collapsed") }]
      : [],
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[45] md:hidden"
      data-testid="challenge-rider-tracks-sheet"
    >
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            data-testid="challenge-rider-tracks-backdrop"
            className="pointer-events-auto absolute inset-0 bg-on-surface/50"
            initial={reducedMotion ? { opacity: 0.5 } : { opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
            onClick={() => setSheetState("collapsed")}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        ref={panelRef}
        id={SHEET_ID}
        role={isExpanded ? "dialog" : undefined}
        aria-modal={isExpanded ? "true" : undefined}
        aria-labelledby={SHEET_TITLE_ID}
        tabIndex={isExpanded ? -1 : undefined}
        className="pointer-events-auto absolute bottom-0 left-0 right-0 flex max-h-[min(80dvh,42rem)] flex-col overflow-hidden rounded-t-[16px] border border-b-0 border-outline-variant bg-surface-container-lowest pb-[env(safe-area-inset-bottom)] outline-none"
        initial="collapsed"
        animate={sheetState}
        variants={{
          collapsed: { y: "calc(100% - 3.75rem)" },
          expanded: { y: 0 },
        }}
        transition={
          reducedMotion
            ? { duration: 0.01 }
            : { type: "spring", damping: 30, stiffness: 320 }
        }
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          setSheetState(
            resolveChallengeSheetState(
              sheetState,
              info.offset.y,
              info.velocity.y,
            ),
          );
        }}
      >
        <div className="shrink-0 border-b border-outline-variant bg-surface-container-low">
          <div
            aria-hidden="true"
            className="mx-auto mt-2 h-1.5 w-12 touch-none cursor-grab rounded-full bg-outline-variant active:cursor-grabbing"
            onPointerDown={(event) => dragControls.start(event.nativeEvent)}
          />
          <button
            type="button"
            onClick={() =>
              setSheetState((current) =>
                current === "expanded" ? "collapsed" : "expanded",
              )
            }
            aria-label={
              isExpanded ? "Collapse Crew Board" : "Expand Crew Board — See Who’s Riding"
            }
            aria-controls={SHEET_ID}
            aria-expanded={isExpanded}
            className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left focus-visible:outline-offset-[-4px]"
          >
            <span className="flex min-w-0 shrink-0 items-center gap-2">
              <Flag size={16} aria-hidden="true" />
              <span
                id={SHEET_TITLE_ID}
                className="truncate font-display text-sm font-bold uppercase tracking-[0.05em]"
              >
                Crew Board
              </span>
            </span>
            {!isExpanded && game.players.length > 0 ? (
              <span
                aria-hidden="true"
                className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden"
              >
                {game.players
                  .filter((player) => player.status !== "left")
                  .slice(0, 2)
                  .map((player) => (
                    <span
                      key={player.id}
                      className={`inline-flex max-w-[8.5rem] items-center truncate rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] ${player.id === game.currentChallengerPlayerId ? "border-primary/40 bg-primary-container text-on-primary-container" : "border-outline-variant bg-surface-container-lowest text-on-surface"}`}
                    >
                      {`${player.displayName}: ${player.letters || "—"}`}
                    </span>
                  ))}
              </span>
            ) : null}
            {isExpanded ? (
              <ChevronDown size={17} aria-hidden="true" />
            ) : (
              <ChevronUp size={17} aria-hidden="true" />
            )}
          </button>
        </div>

        {isExpanded ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5 sm:px-4">
            <ChallengeRiderTracksContent
              game={game}
              headingId={SHEET_TITLE_ID}
              showHeader={false}
            />
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
