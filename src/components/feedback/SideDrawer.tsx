"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useBodyScrollLock } from "@/hooks/ui/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/ui/useFocusTrap";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { cn } from "@/lib/utils/cn";

const EMPTY_SHORTCUTS: { key: string; handler: () => void }[] = [];

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  panelClassName?: string;
  containerClassName?: string;
  contentId?: string;
  testId?: string;
  side?: "left" | "right" | "top" | "bottom";
  closeOnBackdrop?: boolean;
  closeOnRouteChange?: boolean;
}

export function SideDrawer({
  isOpen,
  onClose,
  labelledBy,
  children,
  panelClassName,
  containerClassName,
  contentId,
  testId,
  side = "right",
  closeOnBackdrop = true,
  closeOnRouteChange = true,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const reducedMotion = useReducedMotion();
  const shortcuts = useMemo(
    () => (isOpen ? [{ key: "Escape", handler: onClose }] : EMPTY_SHORTCUTS),
    [isOpen, onClose],
  );

  useBodyScrollLock(isOpen);
  useFocusTrap(panelRef, isOpen);
  useKeyboardShortcuts(shortcuts);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const routeChanged = previousPathnameRef.current !== pathname;
    previousPathnameRef.current = pathname;
    if (routeChanged && closeOnRouteChange && isOpen) onCloseRef.current();
  }, [closeOnRouteChange, isOpen, pathname]);

  const isVertical = side === "top" || side === "bottom";
  const closedTransform = isVertical
    ? { y: side === "top" ? "-100%" : "100%" }
    : { x: side === "right" ? "100%" : "-100%" };
  const openTransform = isVertical ? { y: 0 } : { x: 0 };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div
          id={contentId}
          className={cn("fixed inset-0 z-[1200]", containerClassName)}
          data-testid={testId}
        >
          <motion.div
            className="absolute inset-0 bg-on-surface"
            initial={reducedMotion ? { opacity: 0.5 } : { opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={cn(
              "absolute flex flex-col bg-surface-bright outline-none",
              side === "top"
                ? "inset-x-0 top-0 max-h-[min(90dvh,48rem)] pt-[env(safe-area-inset-top)]"
                : side === "bottom"
                  ? "inset-x-0 bottom-0 max-h-[min(90dvh,48rem)] pb-[env(safe-area-inset-bottom)]"
                : "inset-y-0",
              !isVertical ? (side === "right" ? "right-0" : "left-0") : null,
              panelClassName,
            )}
            initial={reducedMotion ? { opacity: 0 } : closedTransform}
            animate={reducedMotion ? { opacity: 1 } : openTransform}
            exit={reducedMotion ? { opacity: 0 } : closedTransform}
            transition={
              reducedMotion
                ? { duration: 0.18 }
                : { type: "spring", damping: 30, stiffness: 320 }
            }
          >
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
