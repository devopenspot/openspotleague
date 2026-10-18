"use client";

import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SearchTriggerProps {
  onClick: () => void;
  className?: string;
}

export function SearchTrigger({ onClick, className }: SearchTriggerProps) {
  return (
    <button
      id="search-trigger-btn"
      type="button"
      onClick={onClick}
      aria-label="Open search"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "flex items-center space-x-2 rounded-full border border-outline-variant bg-surface px-4 py-1.5 text-xs text-secondary transition-all hover:border-outline hover:text-on-surface md:text-sm",
        className,
      )}
    >
      <Search size={14} aria-hidden="true" />
      <kbd
        aria-hidden="true"
        className="hidden rounded-none bg-surface-container px-1.5 py-0.5 text-[10px] font-display md:inline"
      >
        ⌘K
      </kbd>
    </button>
  );
}
