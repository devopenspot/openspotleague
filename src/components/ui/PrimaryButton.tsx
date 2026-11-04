import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils/cn"
import { controlClass } from "./recipes"

interface PrimaryButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children: ReactNode
  type?: "button" | "submit" | "reset"
  variant?: "solid" | "outline"
  fullWidth?: boolean
  size?: "sm" | "md"
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
        controlClass(variant === "solid" ? "primary" : "outline", size),
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
