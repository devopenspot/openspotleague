"use client";

import { Drawer } from "@base-ui/react/drawer";
import { ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type SheetDetent = "peek" | "half" | "full";

const HALF_SNAP = 0.55;
const FULL_SNAP = 0.92;
const DETENT_ORDER: readonly SheetDetent[] = ["peek", "half", "full"];

export function nextSheetDetent(detent: SheetDetent): SheetDetent {
  const index = DETENT_ORDER.indexOf(detent);
  return DETENT_ORDER[(index + 1) % DETENT_ORDER.length] ?? "peek";
}

interface BottomSheetProps {
  /** Accessible name of the sheet region. */
  label: string;
  detent: SheetDetent;
  onDetentChange: (detent: SheetDetent, source: "user") => void;
  /** Peek height in px, before the safe-area inset is added. */
  peekHeight: number;
  /** Status content rendered inside the full-width handle button. */
  handle: ReactNode;
  /** Pinned to the sheet's visible bottom edge at every detent. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Non-modal sheet that can't be dismissed: swipe-down stops at peek. Nothing
 * may depend on a drag, so the footer stays on the visible edge at every detent
 * and the handle button cycles detents (DESIGN.md, overlays.game-sheet).
 */
export function BottomSheet({
  label,
  detent,
  onDetentChange,
  peekHeight,
  handle,
  footer,
  children,
  className,
  testId,
}: BottomSheetProps) {
  const safeAreaProbeRef = useRef<HTMLDivElement>(null);
  const dismissAttemptRef = useRef(false);
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);

  useEffect(() => {
    const probe = safeAreaProbeRef.current;
    if (!probe) return;
    setSafeAreaBottom(Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0);
  }, []);

  const peekSnap = `${peekHeight + safeAreaBottom}px`;
  const snapPoints = useMemo(
    () => [peekSnap, HALF_SNAP, FULL_SNAP],
    [peekSnap],
  );
  const activeSnap =
    detent === "full" ? FULL_SNAP : detent === "half" ? HALF_SNAP : peekSnap;

  return (
    <>
      <div
        ref={safeAreaProbeRef}
        aria-hidden="true"
        className="invisible fixed bottom-0 h-0 pb-[env(safe-area-inset-bottom)]"
      />
      <Drawer.Root
        open
        modal={false}
        disablePointerDismissal
        snapPoints={snapPoints}
        snapPoint={activeSnap}
        snapToSequentialPoints
        onSnapPointChange={(snap) => {
          // A flick past peek clears the snap point, then restores the previous
          // one once the close is cancelled. Land on peek, not where it started.
          if (snap === null) {
            dismissAttemptRef.current = true;
            return;
          }
          if (dismissAttemptRef.current) {
            dismissAttemptRef.current = false;
            onDetentChange("peek", "user");
          } else if (snap === FULL_SNAP) onDetentChange("full", "user");
          else if (snap === HALF_SNAP) onDetentChange("half", "user");
          else onDetentChange("peek", "user");
        }}
        onOpenChange={(open, details) => {
          if (!open) details.cancel();
        }}
      >
        <Drawer.Portal keepMounted>
          <Drawer.Viewport className="pointer-events-none fixed inset-0 z-[45] md:hidden">
            <Drawer.Popup
              role="region"
              aria-label={label}
              aria-modal={undefined}
              initialFocus={false}
              data-testid={testId}
              className={cn(
                "pointer-events-auto absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col overflow-hidden rounded-t-lg border-t-2 border-on-surface bg-surface-container-lowest text-on-surface outline-none",
                "[padding-bottom:max(0px,calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))]",
                "transition-[transform,padding-bottom] duration-[280ms] ease-out data-[swiping]:transition-none motion-reduce:transition-none",
                className,
              )}
            >
              <button
                type="button"
                onClick={() => onDetentChange(nextSheetDetent(detent), "user")}
                aria-expanded={detent !== "peek"}
                className="flex min-h-12 w-full shrink-0 touch-none items-center gap-3 px-4 text-left focus-visible:outline-offset-[-4px]"
              >
                <span className="min-w-0 flex-1">{handle}</span>
                <ChevronUp
                  size={22}
                  aria-hidden="true"
                  className={cn(
                    "shrink-0 transition-transform duration-[280ms] motion-reduce:transition-none",
                    detent === "full" ? "rotate-180" : null,
                  )}
                />
              </button>
              <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {children}
              </Drawer.Content>
              {footer ? (
                <div className="shrink-0 bg-surface-container-lowest px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  {footer}
                </div>
              ) : null}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
