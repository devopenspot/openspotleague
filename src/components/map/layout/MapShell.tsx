"use client";

import type { ReactNode } from "react";

/**
 * @deprecated MapShell is consolidated into AppShell (`src/components/shell/AppShell.tsx`).
 * Kept as pass-through for backwards compatibility.
 */
export function MapShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
