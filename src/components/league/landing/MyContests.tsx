"use client";

/**
 * "My contests" on the League landing: the signed-in viewer's contests
 * grouped by role, with payment-gate states surfaced via PaymentGateNotice.
 * Data comes from GET /api/league/events (role-aware payload, see
 * listMyLeagueEvents). Rendered only for signed-in users.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ChevronRight, Plus, Trophy } from "lucide-react";
import { PaymentGateNotice } from "@/components/league/PaymentGateNotice";
import { MyContestsSkeleton } from "@/components/league/landing/ContestSkeleton";
import {
  alertClass,
  BODY,
  CARD,
  CARD_TITLE,
  controlClass,
  EMPTY_STATE,
  EYEBROW_ON_GRADIENT,
  META,
  SECTION_TITLE,
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
  buildContestHubUrl,
  buildContestJudgeUrl,
  buildContestManageUrl,
  CONTEST_NEW_PATH,
} from "@/lib/league/urls";
import {
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";

interface MyContestItem {
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

function MyContestCard({ item }: { item: MyContestItem }) {
  // Straight to the role's working tab in the contest hub.
  const href = isOrganizerRole(item.myRole)
    ? buildContestManageUrl(item.slug)
    : item.myRole === "judge"
      ? buildContestJudgeUrl(item.slug)
      : buildContestHubUrl(item.slug, "my-runs");
  return (
    <li>
      <Link
        href={href}
        className={`group flex flex-col gap-3 ${CARD} text-on-surface transition-colors duration-150 ease-out hover:border-on-surface`}
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
                ? "Register this contest's plan payment to unlock features."
                : item.paymentState === "locked"
                  ? "The contest is read-only until a payment is registered."
                  : "This contest was disabled definitively because no payment was registered in time."
            }
            paymentDueAt={item.paymentDueAt}
            paymentDeadlineAt={item.paymentDeadlineAt}
          />
        ) : null}
      </Link>
    </li>
  );
}

export function MyContests() {
  const [items, setItems] = useState<MyContestItem[]>([]);
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
          const data = (await response.json()) as { items: MyContestItem[] };
          if (cancelled) return;
          setItems(data.items);
        } else {
          setError("Your contests could not be loaded. Try again shortly.");
        }
      } catch {
        if (cancelled) return;
        setError("Your contests could not be loaded. Try again shortly.");
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
    <section
      id="my-contests"
      aria-labelledby="my-contests-heading"
      className="space-y-4"
    >
      <div>
        <p className={EYEBROW_ON_GRADIENT}>Organizing, judging and riding</p>
        <h2
          id="my-contests-heading"
          className={`mt-1 ${SECTION_TITLE} text-on-gradient`}
        >
          My contests
        </h2>
      </div>

      {loading ? (
        <MyContestsSkeleton />
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
        <div
          className={`flex flex-col items-center gap-3 ${EMPTY_STATE} text-on-surface`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-outline-variant bg-surface-container-high text-secondary">
            <Trophy size={20} aria-hidden="true" />
          </div>
          <h3 className={`${CARD_TITLE} text-on-surface`}>No contests yet</h3>
          <p className={`max-w-sm ${BODY}`}>
            Create your first contest — you can judge too, invite riders with a
            QR code or link, and the engine handles schedule and results.
          </p>
          <Link
            href={CONTEST_NEW_PATH}
            className={`mt-1 ${controlClass("primary")}`}
          >
            <Plus size={14} aria-hidden="true" />
            Create a contest
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          <RoleGroup title="Organizing" items={organizing} />
          <RoleGroup title="Judging" items={judging} />
          <RoleGroup title="Riding" items={riding} />
        </div>
      )}
    </section>
  );
}

function RoleGroup({
  title,
  items,
}: {
  title: string;
  items: MyContestItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section aria-label={title}>
      <h3 className={`mb-3 ${EYEBROW_ON_GRADIENT}`}>
        {title} · {items.length}
      </h3>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <MyContestCard key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
