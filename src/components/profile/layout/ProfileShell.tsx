import type { HTMLAttributes, ReactNode } from "react";
import { pageContainer } from "@/components/ui/recipes";

/**
 * Profile page frame: the lime route wash (DESIGN.md pages.profile) filling
 * the viewport, with the shared page column inside. Used by the loaded,
 * loading and error states so they never drift apart.
 */
export function ProfileShell({
  children,
  ...rest
}: { children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className="min-h-full bg-gradient-profile">
      <div className={`${pageContainer("5xl", { padY: false })} py-5 sm:py-6`}>
        {children}
      </div>
    </div>
  );
}
