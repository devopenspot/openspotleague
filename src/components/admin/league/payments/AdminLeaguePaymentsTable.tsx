"use client";

/**
 * Admin payment queue (`league.manage`): pending-first table with mark
 * actions calling POST /api/admin/league/payments/[id].
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { BadgeDollarSign, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { money } from "@/lib/league/ui-state";

interface PaymentQueueItem {
  id: string;
  eventId: string;
  eventSlug: string;
  eventName: string;
  planSlug: string;
  status: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string | null;
  payerName: string;
  createdAt: string;
  paidAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  comped: "Comp'd",
  refunded: "Refunded",
  failed: "Failed",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function AdminLeaguePaymentsTable() {
  const [items, setItems] = useState<PaymentQueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const query = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const response = await fetch(`/api/admin/league/payments${query}`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (response.ok) {
        const data = (await response.json()) as { items: PaymentQueueItem[] };
        setItems(data.items);
      } else {
        setError("The payment queue could not be loaded.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  async function mark(paymentId: string, status: string) {
    setBusyId(paymentId);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/admin/league/payments/${paymentId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(raw?.message ?? raw?.error ?? "Action failed.");
        return;
      }
      if (statusFilter === "all") {
        setItems((current) =>
          current.map((item) =>
            item.id === paymentId ? { ...item, status } : item,
          ),
        );
      } else {
        setItems((current) => current.filter((item) => item.id !== paymentId));
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2" aria-label="Payment status filter">
        {["pending", "paid", "comped", "refunded", "failed", "all"].map((value) => (
          <button
            key={value}
            data-nav-tab
            type="button"
            aria-pressed={statusFilter === value}
            onClick={() => setStatusFilter(value)}
            className={cn(
              "min-h-9 rounded-full border px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] transition-colors",
              statusFilter === value
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant bg-surface-container-high text-secondary hover:border-outline hover:text-on-surface",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {actionError}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-lg bg-surface-container"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-6 py-12 text-center">
          <BadgeDollarSign size={24} aria-hidden="true" className="text-secondary" />
          <p className="font-display text-sm font-semibold">
            No {statusFilter === "all" ? "" : `${statusFilter} `}payments
          </p>
          <p className="max-w-sm text-sm text-secondary">
            Event payment registrations will appear here for review.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/sport-events/${item.eventSlug}`}
                  className="font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface hover:underline"
                >
                  {item.eventName}
                </Link>
                <p className="mt-0.5 text-xs text-secondary">
                  {item.payerName} · {item.planSlug} · {money(item.amountCents, item.currency)} ·
                  registered {formatDate(item.createdAt)}
                  {item.provider ? ` · ${item.provider}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-md border border-outline-variant px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
                  {STATUS_LABELS[item.status] ?? item.status}
                </span>
                {item.status === "pending" ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void mark(item.id, "paid")}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-primary hover:opacity-90 disabled:opacity-50"
                    >
                      <Check size={12} aria-hidden="true" />
                      Mark paid
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void mark(item.id, "comped")}
                      className="min-h-9 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface hover:border-outline disabled:opacity-50"
                    >
                      Compl
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => void mark(item.id, "failed")}
                      className="inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 text-secondary hover:border-error hover:text-error disabled:opacity-50"
                      aria-label={`Mark ${item.eventName} payment failed`}
                    >
                      <RotateCcw size={12} aria-hidden="true" />
                    </button>
                  </>
                ) : null}
                {item.status === "paid" || item.status === "comped" ? (
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void mark(item.id, "refunded")}
                    className="min-h-9 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface hover:border-outline disabled:opacity-50"
                  >
                    Refund
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
