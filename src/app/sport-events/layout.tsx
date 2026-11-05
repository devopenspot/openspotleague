import type { ReactNode } from "react";

export default function SportEventsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-[calc(100dvh-var(--app-header-h))] w-full bg-gradient-events text-on-gradient">
      {children}
    </div>
  );
}
