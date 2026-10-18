import type { ReactNode } from "react";
import { AlertTriangle, Lock, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Highlighted announcement for the league payment gate. Rendered on every
 * organizer/judge/rider surface while a payment is required to move forward
 * (pending → warning, locked → read-only + payment-only, disabled → final).
 * `action` is the pay/upgrade CTA slot — the only enabled control while
 * locked.
 */
export type PaymentGateNoticeState = "pending" | "locked" | "disabled";

interface PaymentGateNoticeProps {
  state: PaymentGateNoticeState;
  title: string;
  message: string;
  paymentDueAt?: string | null;
  paymentDeadlineAt?: string | null;
  action?: ReactNode;
}

const STATE_STYLES: Record<PaymentGateNoticeState, string> = {
  pending: "border-outline-variant bg-surface-container-low",
  // --color-primary is reserved for CTAs/active/critical states (DESIGN.md) —
  // the locked state signals "action needed" via the Lock icon + title text,
  // not by spending the primary token on a border.
  locked: "border-outline bg-surface-container-low",
  disabled: "border-outline bg-surface-container opacity-90",
};

const STATE_ICONS: Record<PaymentGateNoticeState, typeof Lock> = {
  pending: AlertTriangle,
  locked: Lock,
  disabled: CircleSlash,
};

function formatDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export function PaymentGateNotice({
  state,
  title,
  message,
  paymentDueAt,
  paymentDeadlineAt,
  action,
}: PaymentGateNoticeProps) {
  const Icon = STATE_ICONS[state];
  const due = formatDeadline(paymentDueAt);
  const deadline = formatDeadline(paymentDeadlineAt);

  return (
    <section
      data-payment-state={state}
      role={state === "disabled" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex flex-col gap-2 rounded-[16px] border p-4 sm:p-5",
        STATE_STYLES[state],
      )}
    >
      <div className="flex items-center gap-2">
        <Icon size={16} aria-hidden="true" className="shrink-0" />
        <h2 className="font-display text-xs font-bold uppercase tracking-widest">
          {title}
        </h2>
      </div>
      <p className="text-sm leading-relaxed text-secondary">{message}</p>
      {(due || deadline) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 font-display text-xs font-semibold uppercase tracking-wider">
          {due && state === "pending" && (
            <div>
              <dt className="text-secondary">Read-only after</dt>
              <dd>{due}</dd>
            </div>
          )}
          {deadline && (
            <div>
              <dt className="text-secondary">Disabled after</dt>
              <dd>{deadline}</dd>
            </div>
          )}
        </dl>
      )}
      {action && state !== "disabled" && <div className="pt-1">{action}</div>}
    </section>
  );
}
