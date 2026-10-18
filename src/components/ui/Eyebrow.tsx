import type { ReactNode } from "react"
import { cn } from "@/lib/utils/cn"

interface EyebrowProps {
  children: ReactNode
  className?: string
  as?: "span" | "div" | "h2" | "h3" | "p"
  icon?: ReactNode
}

export function Eyebrow({ children, className, as: Tag = "span", icon }: EyebrowProps) {
  return (
    <Tag
      className={cn(
        "font-mono text-[10px] font-bold tracking-widest text-secondary uppercase",
        className,
      )}
    >
      {icon ? (
        <span className="inline-flex items-center">
          <span aria-hidden="true" className="mr-1.5">
            {icon}
          </span>
          {children}
        </span>
      ) : (
        children
      )}
    </Tag>
  )
}
