"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/data/useNotifications";
import { useUser } from "@/lib/contexts/user-context";
import { iconButtonClass } from "@/components/ui/recipes";
import { cn } from "@/lib/utils/cn";

export function NotificationBell() {
  const user = useUser();
  const unreadCount = useUnreadNotificationCount(user?.id ?? null);
  if (!user) return null;
  const badge = unreadCount > 99 ? "99+" : unreadCount > 0 ? unreadCount : null;

  return (
    <Link
      href="/notifications"
      aria-label={
        unreadCount > 0
          ? `Notifications, ${unreadCount} unread`
          : "Notifications"
      }
      className={cn("relative", iconButtonClass("onWireOutline"))}
    >
      <Bell size={18} aria-hidden="true" />
      {badge && (
        <span
          data-notification-badge
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-control bg-on-wire px-1 font-display text-[10px] font-bold leading-none text-wire ring-2 ring-wire"
        >
          {badge}
        </span>
      )}
      <span aria-live="polite" className="sr-only">
        {badge ? `${unreadCount} unread notifications` : ""}
      </span>
    </Link>
  );
}
