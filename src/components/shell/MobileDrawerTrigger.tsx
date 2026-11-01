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
      className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-wire-border bg-wire-border text-on-wire transition-[background-color,border-color,transform] hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
    >
      <Menu size={18} aria-hidden="true" />
    </button>
  );
}
