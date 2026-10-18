"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface HelpButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  children?: ReactNode;
}

export function HelpButton({ label, children, className, ...props }: HelpButtonProps) {
  return (
    <button type="button" aria-label={label} title={label} className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline px-2.5 font-display text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", className)} {...props}>
      <CircleHelp size={14} aria-hidden="true" />
      {children ? <span>{children}</span> : null}
    </button>
  );
}
