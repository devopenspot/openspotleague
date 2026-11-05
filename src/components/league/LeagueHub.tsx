"use client";

/**
 * League hub — my events grouped by my role, with payment-gate states
 * surfaced via PaymentGateNotice. Data comes from GET /api/league/events
 * (role-aware payload, see listMyLeagueEvents).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Plus, Trophy } from "lucide-react";
import { JoinByCodeEntry } from "@/components/league/JoinByCodeEntry";
import { PaymentGateNotice } from "@/components/league/PaymentGateNotice";
import {
  alertClass,
  BODY,
  CARD,
  CARD_TITLE,
  controlClass,
  EMPTY_STATE,
  EYEBROW,
  META,
  PAGE_TITLE,
  pageContainer,
  tagClass,
} from "@/components/ui/recipes";
import {
  formatDateRange,
  groupLeagueEvents,
  isOrganizerRole,
  roleLabel,
  statusLabel,
} from "@/lib/league/ui-state";
import {
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";

interface MyLeagueEventItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  planSlug: string;
  timezone: string;
  startDate: string;
  endDate: string | null;
  version: number;
  myRole: "main_organizer" | "organizer" | "judge" | "rider";
  paymentState: "pending" | "locked" | "disabled" | "settled";
  paymentDueAt: string | null;
  paymentDeadlineAt: string | null;
}

function planLabel(planSlug: string): string {
  if (planSlug === "free") return "Free plan";
  return `${planSlug.charAt(0).toUpperCase()}${planSlug.slice(1)} plan`;
}

function EventCard({ item }: { item: MyLeagueEventItem }) {
  const rolePath = isOrganizerRole(item.myRole)
    ? `/sport-events/${item.slug}/manage`
    : `/sport-events/${item.slug}`;
  return (
    <li>
      <Link
        href={rolePath}
        className={`group flex flex-col gap-3 ${CARD} transition-colors duration-150 ease-out hover:border-on-surface`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`${CARD_TITLE} text-on-surface group-hover:underline`}>
              {item.name}
            </p>
            <p className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 ${META}`}>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={12} aria-hidden="true" />
                {formatDateRange(item.startDate, item.endDate)}
              </span>
              <span aria-hidden="true">·</span>
              {planLabel(item.planSlug)}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={tagClass("outline")}>
                {statusLabel(item.status)}
              </span>
              <span className={tagClass("neutral")}>
                {roleLabel(item.myRole)}
              </span>
            </div>
          </div>
          <ChevronRight
            size={18}
            aria-hidden="true"
            className="mt-1 shrink-0 text-secondary transition-transform duration-150 ease-out group-hover:translate-x-0.5"
          />
        </div>
        {item.paymentState !== "settled" ? (
          <PaymentGateNotice
            state={item.paymentState}
            title="Payment required to move forward"
            message={
              item.paymentState === "pending"
                ? "Register this event's plan payment to unlock features."
                : item.paymentState === "locked"
                  ? "The event is read-only until a payment is registered."
                  : "This event was disabled definitively because no payment was registered in time."
            }
            paymentDueAt={item.paymentDueAt}
            paymentDeadlineAt={item.paymentDeadlineAt}
          />
        ) : null}
      </Link>
    </li>
  );
}

export default function LeagueHub() {
  const [items, setItems] = useState<MyLeagueEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchWithTimeout("/api/league/events", {
          cache: "no-store",
          timeoutMs: DEFAULT_READ_TIMEOUT_MS,
        });
        if (cancelled) return;
        if (response.ok) {
          const data = (await response.json()) as { items: MyLeagueEventItem[] };
          if (cancelled) return;
          setItems(data.items);
        } else {
          setError("Your events could not be loaded. Try again shortly.");
        }
      } catch {
        if (cancelled) return;
        setError("Your events could not be loaded. Try again shortly.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setReloadTick((tick) => tick + 1);
  }, []);

  const { organizing, judging, riding } = groupLeagueEvents(items);

  return (
    <div className={pageContainer("3xl")}>
      <header className="mb-8 flex flex-col gap-5">
        <div>
          <p className={EYEBROW}>League</p>
          <h1 className={`mt-1 ${PAGE_TITLE} text-on-surface`}>
            My sport events
          </h1>
          <p className={`mt-2 max-w-xl ${BODY}`}>
            Events you organize, judge or ride in. Join one with an invite code
            or create your own.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/league/new" className={controlClass("primary")}>
            <Plus size={14} aria-hidden="true" />
            New event
          </Link>
          <JoinByCodeEntry variant="compact" />
          <Link href="/sport-events" className={controlClass("outline")}>
            Browse sport events
          </Link>
        </div>
      </header>

      {loading ? (
        <div aria-busy="true">
          <p className="sr-only">Loading your events…</p>
          <div className="flex flex-col gap-3" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-container border border-outline-variant bg-surface-container-lowest"
              />
            ))}
          </div>
        </div>
      ) : error ? (
        <div
          role="alert"
          className={`flex flex-col items-start gap-3 text-sm ${alertClass("error")}`}
        >
          {error}
          <button
            type="button"
            onClick={retry}
            className={controlClass("outline", "sm")}
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={`flex flex-col items-center gap-3 ${EMPTY_STATE}`}>
          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-secondary">
            <Trophy size={20} aria-hidden="true" />
          </div>
          <h2 className={`${CARD_TITLE} text-on-surface`}>No events yet</h2>
          <p className={`max-w-sm ${BODY}`}>
            Create your first competition — you can judge too, invite riders
            with a link, and the engine handles schedule and results.
          </p>
          <Link
            href="/league/new"
            className={`mt-1 ${controlClass("primary")}`}
          >
            <Plus size={14} aria-hidden="true" />
            Create an event
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <RoleGroup title="Organizing" items={organizing} />
          <RoleGroup title="Judging" items={judging} />
          <RoleGroup title="Riding" items={riding} />
        </div>
      )}
    </div>
  );
}

function RoleGroup({
  title,
  items,
}: {
  title: string;
  items: MyLeagueEventItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className={`mb-3 ${EYEBROW}`}>
        {title} · {items.length}
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <EventCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
