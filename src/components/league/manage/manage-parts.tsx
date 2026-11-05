"use client";

/**
 * Presentational blocks for the organizer console (repo convention: in-file
 * helper components live in a sibling `manage-parts.tsx`).
 */

import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, Trash2, Users } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Overlay } from "@/components/feedback/Overlay";
import { RunScoreForm } from "@/components/league/RunScoreForm";
import type { LeagueEventState } from "@/lib/services/league";
import {
  BODY,
  CARD,
  CARD_NESTED,
  CARD_TITLE,
  LABEL,
  controlClass,
  iconButtonClass,
  tagClass,
} from "@/components/ui/recipes";
import { buildContestJoinUrl } from "@/lib/league/urls";

/**
 * @deprecated Admin league panels still use this square control. League
 * surfaces use the INPUT recipe; move the admin panels when admin moves onto
 * the recipes (DESIGN.md open-follow-ups).
 */
export const MANAGE_CONTROL_CLASSES =
  "w-full rounded-md border border-outline-variant bg-surface-bright p-3 text-base sm:text-sm font-medium text-on-surface shadow-none transition-colors focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50";

export function StateBadge({ status }: { status: string }) {
  const label = status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return (
    <span className={tagClass("outline")}>
      {label}
    </span>
  );
}

export function ConfirmButton({
  label,
  confirmTitle,
  confirmBody,
  onConfirm,
  disabled,
  variant = "outline",
}: {
  label: string;
  confirmTitle: string;
  confirmBody: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "outline" | "primary";
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={controlClass(variant)}
      >
        {label}
      </button>
      {/* Repo Overlay primitive: focus trap, ESC to close, focus restore. */}
      <Overlay
        isOpen={open}
        onClose={() => setOpen(false)}
        labelledBy={titleId}
        describedBy={bodyId}
        role="alertdialog"
        contentId="confirm-dialog"
      >
        <div className={`w-full max-w-md text-on-surface ${CARD}`}>
          <h2 id={titleId} className={CARD_TITLE}>
            {confirmTitle}
          </h2>
          <p id={bodyId} className={`mt-2 ${BODY}`}>
            {confirmBody}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={controlClass("outline")}
            >
              Keep as is
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className={controlClass("primary")}
            >
              Confirm
            </button>
          </div>
        </div>
      </Overlay>
    </>
  );
}

export interface InviteItem {
  id: string;
  code: string;
  role: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  revoked: boolean;
}

export function InviteRow({
  invite,
  joinBase,
  onRevoke,
  disabled,
}: {
  invite: InviteItem;
  joinBase: string;
  onRevoke: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState<"link" | "qr" | "failed" | null>(null);
  const url = `${joinBase}${buildContestJoinUrl(invite.code)}`;
  return (
    <li
      className={cn(
        `flex flex-wrap items-center justify-between gap-3 ${CARD_NESTED}`,
        invite.revoked && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <p className="font-display text-xs font-bold uppercase tracking-label text-on-surface">
          {invite.role} · {invite.useCount}
          {invite.maxUses ? `/${invite.maxUses}` : ""} used
        </p>
        <p className={`mt-0.5 truncate tabular-nums ${LABEL}`}>
          {invite.code}
          {invite.expiresAt
            ? ` · expires ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(invite.expiresAt))}`
            : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || invite.revoked}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied("link");
              setTimeout(() => setCopied(null), 1500);
            } catch {
              // Clipboard permission denied / insecure context — show the
              // link as selectable text so the user can copy it manually.
              setCopied("failed");
              setTimeout(() => setCopied(null), 2500);
            }
          }}
          className={controlClass("outline", "sm")}
        >
          {copied === "link" ? (
            <Check size={12} aria-hidden="true" />
          ) : (
            <Copy size={12} aria-hidden="true" />
          )}
          {copied === "failed" ? "Copy manually" : "Copy"}
        </button>
        <button
          type="button"
          disabled={disabled || invite.revoked}
          onClick={() => setCopied(copied === "qr" ? null : "qr")}
          aria-expanded={copied === "qr"}
          className={controlClass("outline", "sm")}
        >
          <QrCode size={12} aria-hidden="true" />
          QR
        </button>
        <button
          type="button"
          disabled={disabled || invite.revoked}
          onClick={onRevoke}
          aria-label={`Revoke ${invite.role} invite`}
          className={`${iconButtonClass("outline", "sm")} text-secondary hover:text-error`}
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>
      {copied === "qr" ? (
        <div className="w-fit rounded-card border border-outline-variant bg-surface-container-lowest p-3">
          <QRCodeSVG value={url} size={112} aria-label={`QR code for the ${invite.role} invite`} />
        </div>
      ) : null}
    </li>
  );
}

export function MemberRow({
  displayName,
  role,
  isMainOrganizer,
  onRemove,
  disabled,
}: {
  displayName: string;
  role: string;
  isMainOrganizer: boolean;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const roleLabel = role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return (
    <li className={`flex items-center justify-between gap-3 ${CARD_NESTED}`}>
      <div className="flex min-w-0 items-center gap-2">
        <Users size={14} aria-hidden="true" className="shrink-0 text-secondary" />
        <p className="min-w-0 truncate text-sm font-medium text-on-surface">
          {displayName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={tagClass("neutral")}>
          {roleLabel}
        </span>
        {!isMainOrganizer ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove ${displayName}`}
            className={`${iconButtonClass("outline", "sm")} text-secondary hover:text-error`}
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function RunRow({
  run,
  criteria,
  eventStatus,
  canJudge,
  onOpenWindow,
  onExtendWindow,
  onCloseWindow,
  onSubmitScore,
  disabled,
}: {
  run: LeagueEventState["runs"][number];
  criteria: LeagueEventState["criteria"];
  eventStatus: string;
  canJudge: boolean;
  onOpenWindow: () => void;
  onExtendWindow: () => void;
  onCloseWindow: () => void;
  /** Return true when the submission succeeded; false keeps the scores. */
  onSubmitScore: (scores: Record<string, number>) => boolean | Promise<boolean>;
  disabled?: boolean;
}) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (run.status !== "judging" || run.windowEndsAt === null) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run.status, run.windowEndsAt]);
  const isLive = eventStatus === "live";
  const canOpenWindow = isLive && run.status === "scheduled" && !disabled;
  const isJudging = run.status === "judging";
  const windowActive =
    run.windowEndsAt !== null &&
    (nowMs === null || new Date(run.windowEndsAt).getTime() > nowMs);

  return (
    <li className={`flex flex-col gap-3 ${CARD_NESTED}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-container-high font-display text-xs font-bold tabular-nums text-on-surface">
            {run.sequence}
          </span>
          <div className="min-w-0">
            <p className="min-w-0 truncate text-sm font-semibold text-on-surface">
              {run.riderName}
            </p>
            <p className={LABEL}>
              {run.status}
              {run.scheduledAt
                ? ` · ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(run.scheduledAt))} UTC`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {run.status === "scheduled" ? (
            <button
              type="button"
              disabled={!canJudge || !canOpenWindow}
              onClick={onOpenWindow}
              className={controlClass("primary", "sm")}
            >
              Open window
            </button>
          ) : null}
          {isJudging ? (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={onExtendWindow}
                className={controlClass("outline", "sm")}
              >
                Extend
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onCloseWindow}
                className={controlClass("outline", "sm")}
              >
                Close
              </button>
            </>
          ) : null}
        </div>
      </div>

      {run.scores.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {run.scores.map((score) => (
            <li
              key={`${run.id}-${score.judgeName}`}
              className={tagClass("neutral")}
            >
              {score.judgeName}: {score.total.toFixed(2)}
            </li>
          ))}
        </ul>
      ) : null}

      {isJudging ? (
        <div className="flex flex-col gap-3">
          <p
            className={LABEL}
            aria-live="polite"
          >
            {windowActive
              ? `Window open until ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(run.windowEndsAt!))} UTC`
              : "Window closed — extend to score"}
          </p>
          {canJudge && windowActive && !disabled ? (
            <RunScoreForm
              criteria={criteria}
              disabled={disabled}
              onSubmit={onSubmitScore}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
