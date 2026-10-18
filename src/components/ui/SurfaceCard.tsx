import type { ReactNode } from "react"
import { cn } from "@/lib/utils/cn"

interface SurfaceCardProps {
  children: ReactNode
  className?: string
  as?: "div" | "section" | "article" | "li"
  bordered?: boolean
}

export function SurfaceCard({
  children,
  className,
  as: Tag = "div",
  bordered = true,
}: SurfaceCardProps) {
  return (
    <Tag
      className={cn(
        "rounded-none-none bg-surface-bright",
        bordered && "border border-outline-variant",
        className,
      )}
    >
      {children}
    </Tag>
  )
}
