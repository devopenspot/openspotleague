"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
}

export function ToggleSwitch({ checked, onChange, label, description, disabled = false, id }: ToggleSwitchProps) {
  return (
    <label htmlFor={id} className={cn("flex min-h-12 items-center justify-between gap-3 rounded-lg border-2 border-outline-variant bg-surface-container-lowest px-3 py-2.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <span className="min-w-0">
        <span className="block font-display text-sm font-semibold text-on-surface">{label}</span>
        {description ? <span className="mt-0.5 block text-sm font-semibold leading-5 text-secondary">{description}</span> : null}
      </span>
      <span aria-hidden="true" className={cn("relative h-5 w-10 shrink-0 rounded-full border border-on-surface p-0.5 transition-colors", checked ? "bg-primary" : "bg-surface-container")}>
        <span className={cn("block h-3.5 w-3.5 rounded-full bg-surface-bright transition-transform", checked && "translate-x-4")} />
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="sr-only" />
    </label>
  );
}
