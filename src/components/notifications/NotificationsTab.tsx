"use client";

import Link from "next/link";
import { ArrowRight, BellOff, CheckCheck, Mail } from "lucide-react";
import { notificationHref } from "@/lib/notifications/definitions";
import {
  useEmailPreferences,
  useNotificationList,
  type EmailCategoryKey,
} from "@/hooks/data/useNotifications";
import { useUser } from "@/lib/contexts/user-context";
import { relativeTime } from "@/lib/league/ui-state";
import { cn } from "@/lib/utils/cn";
import {
  EMPTY_STATE,
  EYEBROW,
  META,
  PAGE_TITLE,
  CARD,
  alertClass,
  chipClass,
  controlClass,
  pageContainer,
} from "@/components/ui/recipes";

const EMAIL_CATEGORY_OPTIONS: readonly { key: EmailCategoryKey; label: string; hint: string }[] = [
  { key: "contest_updates", label: "Contest updates", hint: "Registration, schedule and contest changes" },
  { key: "reminders", label: "Reminders", hint: "Deadlines, pending scores and payments" },
  { key: "judging", label: "Judging", hint: "New videos to score, scoring complete" },
  { key: "results", label: "Results", hint: "Published results and placements" },
];

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
    preferences,
    deliveryAvailable,
    saving,
    saveError,
    setCategory,
  } = useEmailPreferences(user?.id ?? null);

  return (
    <div className={pageContainer("3xl")}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={EYEBROW}>Inbox</p>
          <h1 className={`mt-1 ${PAGE_TITLE} text-on-surface`}>
            Notifications
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className={controlClass("outline", "sm")}
            >
              <CheckCheck size={14} aria-hidden="true" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {preferences !== null && deliveryAvailable === true ? (
        <section aria-labelledby="email-preferences-title" className={`mb-6 ${CARD}`}>
          <div className="mb-3 flex items-center gap-2">
            <Mail size={16} aria-hidden="true" className="text-secondary" />
            <h2 id="email-preferences-title" className="font-display text-sm font-semibold text-on-surface">
              Email me about
            </h2>
          </div>
          {preferences.suppressed ? (
            <p className={`mb-3 text-sm ${alertClass("neutral")}`}>
              Emails are paused because your inbox rejected one. Turn a category on to resume.
            </p>
          ) : null}
          {user?.email ? (
            <p className="mb-4 text-sm text-secondary">
              Sent to <span className="break-all text-on-surface">{user.email}</span>
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {EMAIL_CATEGORY_OPTIONS.map((option) => {
              const on = preferences[option.key] && !preferences.suppressed;
              const hintId = `email-category-${option.key}-hint`;
              return (
                <li
                  key={option.key}
                  className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3"
                >
                  <button
                    type="button"
                    disabled={saving}
                    aria-pressed={on}
                    aria-describedby={hintId}
                    onClick={() => void setCategory(option.key, !on)}
                    className={chipClass(on)}
                  >
                    {option.label}
                  </button>
                  <p id={hintId} className="text-sm text-secondary">
                    {option.hint}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {saveError ? (
        <p role="alert" className={`mb-4 text-sm ${alertClass("error")}`}>
          {saveError}
        </p>
      ) : null}
      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 rounded-container bg-surface-container"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={`flex flex-col items-center gap-3 ${EMPTY_STATE}`}>
          <BellOff size={24} aria-hidden="true" className="text-secondary" />
          <p className="font-display text-sm font-semibold">
            You&apos;re all caught up
          </p>
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
                <Link prefetch={false}
                  href={href ?? "/notifications"}
                  data-read={Boolean(item.readAt)}
                  onClick={unread ? () => void markRead([item.id]) : undefined}
                  aria-label={unread ? `${item.title} (unread)` : item.title}
                  className={cn(
                    "flex items-start gap-3 rounded-container border border-outline-variant px-4 py-4 transition-colors hover:border-outline hover:bg-surface-container",
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
                      {unread ? (
                        <span className="sr-only"> (unread)</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-secondary">
                      {item.body}
                    </p>
                    <p className={`mt-1 ${META}`}>
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
          className={`mt-4 w-full ${controlClass("outline")}`}
        >
          Load more
        </button>
      )}
    </div>
  );
}
