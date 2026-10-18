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

export const MANAGE_CONTROL_CLASSES =
  "w-full rounded-md border border-outline-variant bg-surface-bright p-3 text-base sm:text-sm font-medium text-on-surface shadow-none transition-colors focus:border-primary focus:outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-50";

export function StateBadge({ status }: { status: string }) {
  const label = status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return (
    <span className="rounded-md border border-outline-variant px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
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
        className={cn(
          "min-h-11 rounded-full px-5 font-display text-xs font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50",
          variant === "primary"
            ? "bg-primary text-on-primary hover:opacity-90"
            : "border border-outline-variant bg-surface-container-high text-on-surface hover:border-outline",
        )}
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
        <div className="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest p-5">
          <h2 id={titleId} className="font-display text-sm font-bold uppercase tracking-[0.05em]">
            {confirmTitle}
          </h2>
          <p id={bodyId} className="mt-2 text-sm leading-relaxed text-secondary">
            {confirmBody}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface"
            >
              Keep as is
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
              className="min-h-11 rounded-full bg-primary px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary hover:opacity-90"
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
  const url = `${joinBase}/sport-events/join/${invite.code}`;
  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-inner border border-outline-variant bg-surface-bright px-4 py-3",
        invite.revoked && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <p className="font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface">
          {invite.role} · {invite.useCount}
          {invite.maxUses ? `/${invite.maxUses}` : ""} used
        </p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-secondary">
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
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface hover:border-outline disabled:opacity-50"
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
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface hover:border-outline disabled:opacity-50"
        >
          <QrCode size={12} aria-hidden="true" />
          QR
        </button>
        <button
          type="button"
          disabled={disabled || invite.revoked}
          onClick={onRevoke}
          aria-label={`Revoke ${invite.role} invite`}
          className="inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 text-secondary hover:border-error hover:text-error disabled:opacity-50"
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>
      {copied === "qr" ? (
        <div className="w-full rounded-inner bg-surface-bright p-3">
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
    <li className="flex items-center justify-between gap-3 rounded-inner border border-outline-variant bg-surface-bright px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Users size={14} aria-hidden="true" className="shrink-0 text-secondary" />
        <p className="min-w-0 truncate text-sm font-medium text-on-surface">
          {displayName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-md bg-surface-container-high px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface">
          {roleLabel}
        </span>
        {!isMainOrganizer ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            aria-label={`Remove ${displayName}`}
            className="inline-flex min-h-9 items-center rounded-full border border-outline-variant px-3 text-secondary hover:border-error hover:text-error disabled:opacity-50"
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
    <li className="flex flex-col gap-3 rounded-inner border border-outline-variant bg-surface-bright p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-display text-xs font-bold text-on-surface">
            {run.sequence}
          </span>
          <div className="min-w-0">
            <p className="min-w-0 truncate text-sm font-semibold text-on-surface">
              {run.riderName}
            </p>
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.05em] text-secondary">
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
              className="min-h-9 rounded-full bg-primary px-4 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-on-primary hover:opacity-90 disabled:opacity-40"
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
                className="min-h-9 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface hover:border-outline disabled:opacity-40"
              >
                Extend
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={onCloseWindow}
                className="min-h-9 rounded-full border border-outline-variant px-3 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface hover:border-outline disabled:opacity-40"
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
              className="rounded-md bg-surface-container px-2 py-1 font-display text-[10px] font-bold uppercase tracking-[0.05em] text-on-surface"
            >
              {score.judgeName}: {score.total.toFixed(2)}
            </li>
          ))}
        </ul>
      ) : null}

      {isJudging ? (
        <div className="flex flex-col gap-3">
          <p
            className="font-display text-[10px] font-bold uppercase tracking-[0.08em] text-secondary"
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
