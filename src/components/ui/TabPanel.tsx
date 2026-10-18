import type { ReactNode } from "react"
import { cn } from "@/lib/utils/cn"

interface TabPanelProps {
  id?: string
  labelledBy: string
  children: ReactNode
  className?: string
  spacing?: "sm" | "md" | "lg"
  bottomPadding?: boolean
}

const SPACING_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "space-y-4",
  md: "space-y-8",
  lg: "space-y-12",
}

export function TabPanel({
  id,
  labelledBy,
  children,
  className,
  spacing = "md",
  bottomPadding = true,
}: TabPanelProps) {
  return (
    <section
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className={cn(
        SPACING_CLASSES[spacing],
        bottomPadding && "pb-24",
        "animate-fade-in",
        className,
      )}
    >
      {children}
    </section>
  )
}
