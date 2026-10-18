"use client";

import Link from "next/link";
import { ArrowRight, BellOff, CheckCheck, Mail } from "lucide-react";
import { notificationHref } from "@/lib/notifications/definitions";
import { useEmailDigests, useNotificationList } from "@/hooks/data/useNotifications";
import { useUser } from "@/lib/contexts/user-context";
import { relativeTime } from "@/lib/league/ui-state";
import { cn } from "@/lib/utils/cn";

export default function NotificationsTab() {
  const user = useUser();
  const {
    items,
    unreadCount,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
  } = useNotificationList(user?.id ?? null);
  const {
    enabled: emailDigests,
    deliveryAvailable,
    saving,
    saveError,
    setEnabled,
  } = useEmailDigests(user?.id ?? null);

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-xl font-bold">Notifications</h1>
        <div className="flex flex-wrap items-center gap-2">
          {emailDigests !== null && deliveryAvailable === true ? (
            <button
              type="button"
              disabled={saving}
              aria-pressed={emailDigests}
              onClick={() => void setEnabled(!emailDigests)}
              title={
                emailDigests
                  ? "Daily email digests are on — click to turn off"
                  : "Daily email digests are off — click to turn on"
              }
              className={cn(
                "flex items-center gap-2 rounded-full border px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider transition-colors",
                emailDigests
                  ? "border-primary bg-primary text-on-primary"
                  : "border-outline-variant text-secondary hover:border-outline hover:text-on-surface",
              )}
            >
              <Mail size={14} aria-hidden="true" />
              {emailDigests ? "Emails on" : "Emails off"}
            </button>
          ) : null}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="flex items-center gap-2 rounded-full border border-outline-variant px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-secondary transition-colors hover:border-outline hover:text-on-surface"
            >
              <CheckCheck size={14} aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {saveError ? (
        <p role="alert" className="mb-4 text-sm text-error">
          {saveError}
        </p>
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-[16px] bg-surface-container"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[16px] border border-outline-variant bg-surface-container-low px-6 py-12 text-center">
          <BellOff size={24} aria-hidden="true" className="text-secondary" />
          <p className="font-display text-sm font-semibold">You&apos;re all caught up</p>
          <p className="text-sm text-secondary">
            League invitations, schedules and results will show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const href = notificationHref(item.type, item.payload);
            const unread = !item.readAt;
            return (
              <li key={item.id}>
                <Link
                  href={href ?? "/notifications"}
                  data-read={Boolean(item.readAt)}
                  onClick={unread ? () => void markRead([item.id]) : undefined}
                  aria-label={unread ? `${item.title} (unread)` : item.title}
                  className={cn(
                    "flex items-start gap-3 rounded-[16px] border border-outline-variant px-4 py-4 transition-colors hover:border-outline hover:bg-surface-container",
                    unread
                      ? "bg-surface-container font-semibold"
                      : "bg-surface-container-low",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={
                      unread
                        ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                        : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-transparent"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-semibold">
                      {item.title}
                      {unread ? <span className="sr-only"> (unread)</span> : null}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-secondary">
                      {item.body}
                    </p>
                    <p className="mt-1 font-display text-xs uppercase tracking-wider text-secondary">
                      {relativeTime(item.createdAt)}
                    </p>
                  </div>
                  {href && (
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="mt-1 shrink-0 text-secondary"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !loading && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="mt-4 w-full rounded-[16px] border border-outline-variant px-4 py-3 font-display text-xs font-semibold uppercase tracking-wider text-secondary transition-colors hover:border-outline hover:text-on-surface"
        >
          Load more
        </button>
      )}
    </main>
  );
}
