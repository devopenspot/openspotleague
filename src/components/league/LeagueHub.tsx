"use client";

/**
 * League hub — my events grouped by my role, with payment-gate states
 * surfaced via PaymentGateNotice. Data comes from GET /api/league/events
 * (role-aware payload, see listMyLeagueEvents).
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, MapPin, Plus, Trophy, Users } from "lucide-react";
import { JoinByCodeEntry } from "@/components/league/JoinByCodeEntry";
import { PaymentGateNotice } from "@/components/league/PaymentGateNotice";
import {
  formatDateRange,
  groupLeagueEvents,
  isOrganizerRole,
  roleLabel,
  statusLabel,
} from "@/lib/league/ui-state";

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

function EventCard({ item }: { item: MyLeagueEventItem }) {
  const rolePath = isOrganizerRole(item.myRole)
    ? `/sport-events/${item.slug}/manage`
    : `/sport-events/${item.slug}`;
  return (
    <li>
      <Link
        href={rolePath}
        className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:border-outline"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface">
              {item.name}
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-secondary">
              <CalendarDays size={12} aria-hidden="true" />
              {formatDateRange(item.startDate, item.endDate)}
              <span aria-hidden="true">·</span>
              {item.planSlug === "free" ? "Free" : item.planSlug}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="rounded-md border border-outline-variant px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
              {statusLabel(item.status)}
            </span>
            <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface">
              {roleLabel(item.myRole)}
            </span>
          </div>
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
      const response = await fetch("/api/league/events", { cache: "no-store" });
      if (cancelled) return;
      if (response.ok) {
        const data = (await response.json()) as { items: MyLeagueEventItem[] };
        setItems(data.items);
      } else {
        setError("Your events could not be loaded. Try again shortly.");
      }
      setLoading(false);
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
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
            League
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-on-surface">
            My sport events
          </h1>
        </div>
        <Link
          href="/league/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary transition-opacity hover:opacity-90"
        >
          <Plus size={14} aria-hidden="true" />
          New event
        </Link>
      </div>

      <div className="mb-6 flex justify-end">
        <JoinByCodeEntry variant="link" />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-lg bg-surface-container"
            />
          ))}
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {error}
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface transition-colors hover:border-outline"
          >
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-6 py-12 text-center">
          <Trophy size={24} aria-hidden="true" className="text-secondary" />
          <p className="font-display text-sm font-semibold">No events yet</p>
          <p className="max-w-sm text-sm text-secondary">
            Create your first competition — you judge implicitly, invite riders
            with a link, and the engine handles schedule and results.
          </p>
          <Link
            href="/league/new"
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full border border-outline-variant bg-surface-container-high px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface transition-colors hover:border-outline"
          >
            <Plus size={14} aria-hidden="true" />
            Create an event
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <RoleGroup title="Organizing" icon={Trophy} items={organizing} />
          <RoleGroup title="Judging" icon={Users} items={judging} />
          <RoleGroup title="Riding" icon={MapPin} items={riding} />
        </div>
      )}
    </main>
  );
}

function RoleGroup({
  title,
  items,
}: {
  title: string;
  icon: typeof Trophy;
  items: MyLeagueEventItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h2 className="mb-3 font-display text-xs font-bold uppercase tracking-[0.08em] text-secondary">
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
