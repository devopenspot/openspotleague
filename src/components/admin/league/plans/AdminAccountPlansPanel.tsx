"use client";

/**
 * Account-plan grants (`league.manage`): search users by email/name,
 * show current grants, grant/switch or revoke. Revoked users fall back to
 * the default/free caps.
 */

import { useCallback, useEffect, useState } from "react";
import { Search, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { MANAGE_CONTROL_CLASSES } from "@/components/league/manage/manage-parts";

interface AccountPlanItem {
  userId: string;
  displayName: string;
  email: string;
  planSlug: string;
  source: string;
  status: string;
  grantedAt: string;
}

export function AdminAccountPlansPanel({ plans }: { plans: string[] }) {
  const [items, setItems] = useState<AccountPlanItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [grantSlug, setGrantSlug] = useState(plans[0] ?? "free");

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/league/account-plans${query ? `?search=${encodeURIComponent(query)}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setError("Account plans could not be loaded.");
        return;
      }
      const data = (await response.json()) as { items: AccountPlanItem[] };
      setItems(data.items);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load("");
    })();
  }, [load]);

  async function act(userId: string, action: "grant" | "revoke") {
    setBusyId(userId);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/league/account-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "revoke"
            ? { userId, action }
            : { userId, action, planSlug: grantSlug },
        ),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setActionError(raw?.message ?? raw?.error ?? "Action failed.");
        return;
      }
      await load(search);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search);
        }}
      >
        <label className="min-w-0 grow">
          <span className="sr-only">Search by email or name</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email or name…"
            className={MANAGE_CONTROL_CLASSES}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">Plan to grant</span>
          <select
            value={grantSlug}
            onChange={(event) => setGrantSlug(event.target.value)}
            className={MANAGE_CONTROL_CLASSES}
          >
            {plans.map((slug) => (
              <option key={slug} value={slug}>
                {slug}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          aria-label="Search"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary hover:opacity-90"
        >
          <Search size={12} aria-hidden="true" />
          Search
        </button>
      </form>

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
          <UserRoundX size={24} aria-hidden="true" className="text-secondary" />
          <p className="font-display text-sm font-semibold">No grants found</p>
          <p className="max-w-sm text-sm text-secondary">
            Account-plan grants (paid upgrades and admin grants) appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.userId}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3",
                item.status !== "active" && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <p className="min-w-0 truncate text-sm font-medium text-on-surface">
                  {item.displayName}
                </p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-secondary">
                  {item.email} · {item.source} ·{" "}
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(item.grantedAt))}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <span className="rounded-md border border-outline-variant px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
                  {item.planSlug} · {item.status}
                </span>
                <button
                  type="button"
                  disabled={busyId === item.userId || item.planSlug === grantSlug}
                  onClick={() => void act(item.userId, "grant")}
                  className="min-h-9 rounded-full bg-primary px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-primary hover:opacity-90 disabled:opacity-50"
                >
                  Grant {grantSlug}
                </button>
                <button
                  type="button"
                  disabled={busyId === item.userId || item.status !== "active"}
                  onClick={() => void act(item.userId, "revoke")}
                  className="min-h-9 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface hover:border-outline disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
