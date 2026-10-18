import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils/cn"

interface PrimaryButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children: ReactNode
  type?: "button" | "submit" | "reset"
  variant?: "solid" | "outline"
  fullWidth?: boolean
  size?: "sm" | "md"
}

const SIZE_CLASSES: Record<"sm" | "md", string> = {
  sm: "min-h-9 px-4 text-[10px]",
  md: "min-h-10 px-5 text-xs",
}

export function PrimaryButton({
  children,
  className,
  type = "button",
  variant = "solid",
  fullWidth,
  size = "md",
  ...rest
}: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "flex items-center justify-center rounded-full font-bold tracking-widest uppercase transition-all shadow-none disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]",
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        variant === "solid"
          ? "bg-on-surface text-surface hover:bg-on-surface/90"
          : "border border-outline text-on-surface hover:bg-surface-container",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
