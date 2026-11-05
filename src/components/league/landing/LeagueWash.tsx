import type { ReactNode } from "react";

/**
 * The League route wash (electric-blue `bg-gradient-league`, white ink).
 * Wraps the landing, contest detail, join, manage and judge pages. The
 * creation form (`/league/new`) stays on the monochrome surface, which is why
 * this is a component and not `src/app/league/layout.tsx`.
 */
export function LeagueWash({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-var(--app-header-h))] w-full bg-gradient-league text-on-gradient">
      {children}
    </div>
  );
}
