"use client";

import type { ReactNode } from "react";

export function PanelShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`panel-chassis relative overflow-hidden rounded-[20px] border-[1.5px] border-on-surface bg-surface-container-high p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(18,18,18,0.08)] sm:rounded-[24px] sm:p-2 ${className}`}
    >
      {/* top screws */}
      <div className="pointer-events-none absolute left-3 top-3 hidden h-1.5 w-1.5 rounded-full border border-on-surface/20 bg-surface-container-lowest sm:block" />
      <div className="pointer-events-none absolute right-3 top-3 hidden h-1.5 w-1.5 rounded-full border border-on-surface/20 bg-surface-container-lowest sm:block" />
      <div className="pointer-events-none absolute bottom-3 left-3 hidden h-1.5 w-1.5 rounded-full border border-on-surface/20 bg-surface-container-lowest sm:block" />
      <div className="pointer-events-none absolute bottom-3 right-3 hidden h-1.5 w-1.5 rounded-full border border-on-surface/20 bg-surface-container-lowest sm:block" />

      {/* inner deck */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:rounded-[18px]">
        {children}
      </div>
    </div>
  );
}

export function PanelScreenBezel({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const isFlex = className.includes("flex");
  return (
    <div
      className={`panel-screen relative overflow-hidden rounded-[14px] border-[2px] border-on-surface bg-on-surface p-1.5 sm:p-2 ${className}`}
    >
      {label ? (
        <div className="mb-1.5 flex shrink-0 items-center justify-between px-1 sm:mb-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-surface/70">
            {label}
          </span>
          <span className="flex items-center gap-1">
            <i className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(255,49,49,0.8)]" aria-hidden />
            <i className="h-1 w-6 rounded-full bg-surface/20" aria-hidden />
          </span>
        </div>
      ) : null}
      <div
        className={`panel-screen-inner relative overflow-hidden rounded-[12px] border border-outline-variant bg-surface-container-lowest ${isFlex ? "flex min-h-0 flex-1 flex-col overflow-hidden" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

export function ScrewCluster() {
  return (
    <div className="pointer-events-none hidden items-center gap-1.5 sm:flex" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full border border-on-surface/15 bg-surface-container-high shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.2)]" />
      <span className="h-1.5 w-1.5 rounded-full border border-on-surface/15 bg-surface-container-high shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.2)]" />
      <span className="h-1.5 w-1.5 rounded-full border border-on-surface/15 bg-surface-container-high shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.2)]" />
    </div>
  );
}
