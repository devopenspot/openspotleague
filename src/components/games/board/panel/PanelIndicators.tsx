"use client";

type LedTone = "live" | "pending" | "off" | "error";

const toneMap: Record<LedTone, string> = {
  live: "bg-permission-granted shadow-[0_0_8px_rgba(22,163,74,0.7)]",
  pending: "bg-permission-pending shadow-[0_0_8px_rgba(245,158,11,0.7)]",
  off: "bg-outline/60",
  error: "bg-error shadow-[0_0_8px_rgba(186,26,26,0.6)]",
};

export function Led({
  tone = "off",
  label,
}: {
  tone?: LedTone;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`h-2 w-2 shrink-0 rounded-full border border-on-surface/10 ${toneMap[tone]}`}
        aria-hidden
      />
      {label ? (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
          {label}
        </span>
      ) : null}
    </span>
  );
}
