import type { ReactNode } from "react";

/**
 * The League route wash (electric-blue `bg-gradient-league`, white ink).
 * Wraps the landing, contest detail and join pages. The working tools —
 * create (`/league/new`), the organizer console and the judge queue — stay on
 * the monochrome surface (DESIGN.md pages.league), which is why this is a
 * component and not `src/app/league/layout.tsx`.
 */
export function LeagueWash({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-var(--app-header-h))] w-full bg-gradient-league text-on-gradient">
      {children}
    </div>
  );
}
