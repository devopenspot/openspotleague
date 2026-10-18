"use client";

import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";

export function MobileDrawerTrigger() {
  const openDrawer = useUIStore((s) => s.openDrawer);
  return (
    <button
      id="mobile-hamburger-btn"
      type="button"
      onClick={openDrawer}
      aria-label="Open menu"
      aria-controls="mobile-hamburger-portal"
      className="flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-bright text-secondary transition-colors hover:border-outline hover:text-on-surface"
    >
      <Menu size={18} aria-hidden="true" />
    </button>
  );
}
