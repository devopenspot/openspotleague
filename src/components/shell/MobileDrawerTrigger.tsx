"use client";

import { Menu } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { iconButtonClass } from "@/components/ui/recipes";

export function MobileDrawerTrigger() {
  const openDrawer = useUIStore((s) => s.openDrawer);
  return (
    <button
      id="mobile-hamburger-btn"
      type="button"
      onClick={openDrawer}
      aria-label="Open menu"
      aria-controls="mobile-hamburger-portal"
      className={iconButtonClass("onWireOutline")}
    >
      <Menu size={18} aria-hidden="true" />
    </button>
  );
}
