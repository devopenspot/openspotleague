"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils/cn"
import type { User } from "@/lib/auth/user"

interface UserAvatarProps {
  user: Pick<User, "name" | "initials" | "avatarUrl">
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
  lg: "h-16 w-16 text-base",
}

const SIZE_PX: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  xs: "28px",
  sm: "32px",
  md: "36px",
  lg: "64px",
}

export function UserAvatar({ user, size = "sm", className }: UserAvatarProps) {
  const label = user.name || user.initials || "User"
  const [hasError, setHasError] = useState(false)
  const showImage = Boolean(user.avatarUrl) && !hasError
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-on-surface font-display font-bold text-surface shadow-none",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {showImage ? (
        <Image
          src={user.avatarUrl!}
          alt=""
          fill
          sizes={SIZE_PX[size]}
          referrerPolicy="no-referrer"
          className="object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span aria-hidden="true">{user.initials || "OS"}</span>
      )}
    </span>
  )
}
