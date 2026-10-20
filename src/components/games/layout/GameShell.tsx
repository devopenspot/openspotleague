"use client";

import type { ReactNode } from "react";

/**
 * @deprecated GameShell is consolidated into AppShell (`src/components/shell/AppShell.tsx`).
 * Kept as pass-through for backwards compatibility.
 */
export function GameShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
