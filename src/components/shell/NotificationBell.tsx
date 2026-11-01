"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/data/useNotifications";
import { useUser } from "@/lib/contexts/user-context";

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
      className="relative flex h-12 w-12 items-center justify-center rounded-lg border-2 border-wire-border bg-wire-border text-on-wire transition-[background-color,border-color,transform] hover:border-wire-border-strong hover:bg-wire-border-strong focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px"
    >
      <Bell size={16} aria-hidden="true" />
      {badge && (
        <span
          data-notification-badge
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-on-wire px-1 font-display text-[10px] font-bold leading-none text-primary"
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
