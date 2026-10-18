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
      className="relative flex h-11 w-11 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-secondary transition-colors hover:border-outline hover:bg-surface-container-highest hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <Bell size={16} aria-hidden="true" />
      {badge && (
        <span
          data-notification-badge
          className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-display text-[10px] font-bold leading-none text-on-primary"
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
