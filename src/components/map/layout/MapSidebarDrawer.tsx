"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useBodyScrollLock } from "@/hooks/ui/useBodyScrollLock";
import { useFocusTrap } from "@/hooks/ui/useFocusTrap";
import { useKeyboardShortcuts } from "@/hooks/ui/useKeyboardShortcuts";
import { MapSidebarContent } from "@/components/map/layout/MapSidebar";
import { MAP_SIDEBAR_PANEL_ID } from "@/components/map/shared/map-sidebar-ids";
import type { MapSpot } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import type { MapDataStatus } from "@/components/map/panels/MapProvider";

const DRAWER_TITLE_ID = "map-sidebar-drawer-title";
const EMPTY_SHORTCUTS: { key: string; handler: () => void }[] = [];

interface MapSidebarDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  spots: readonly MapSpot[];
  distanceMilesById: ReadonlyMap<string, number>;
  onSelect: (spot: MapSpot) => void;
  dataStatus: MapDataStatus;
  className?: string;
  isGateActive?: boolean;
}

export function MapSidebarDrawer({
  isOpen,
  onOpenChange,
  spots,
  distanceMilesById,
  onSelect,
  dataStatus,
  className,
  isGateActive = false,
}: MapSidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const onOpenChangeRef = useRef(onOpenChange);
  const reducedMotion = useReducedMotion();
  const pathname = usePathname();
  const shortcuts = useMemo(
    () => (isOpen ? [{ key: "Escape", handler: close }] : EMPTY_SHORTCUTS),
    [isOpen, close],
  );

  useBodyScrollLock(isOpen);
  useFocusTrap(panelRef, isOpen);
  useKeyboardShortcuts(shortcuts);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    onOpenChangeRef.current(false);
  }, [pathname]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn("fixed inset-0 z-[1200] lg:hidden", className)}
          data-testid="map-sidebar-drawer"
        >
          <motion.div
            className="absolute inset-0 bg-on-surface"
            initial={reducedMotion ? { opacity: 0.5 } : { opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            id={MAP_SIDEBAR_PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-labelledby={DRAWER_TITLE_ID}
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[min(22rem,calc(100vw-1rem))] flex-col border-r border-outline-variant bg-surface-bright pb-[env(safe-area-inset-bottom)] outline-none md:w-96"
            initial={reducedMotion ? { opacity: 0 } : { x: "-100%" }}
            animate={reducedMotion ? { opacity: 1 } : { x: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { x: "-100%" }}
            transition={
              reducedMotion
                ? { duration: 0.18 }
                : { type: "spring", damping: 30, stiffness: 320 }
            }
          >
            <MapSidebarContent
              spots={spots}
              distanceMilesById={distanceMilesById}
              onSelect={onSelect}
              dataStatus={dataStatus}
              headingId={DRAWER_TITLE_ID}
              listId="map-sidebar-drawer-spots"
              onClose={close}
              isGateActive={isGateActive}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
