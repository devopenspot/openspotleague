"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface JoinByCodeEntryProps {
  variant?: "compact" | "link";
}

export function JoinByCodeEntry({ variant = "compact" }: JoinByCodeEntryProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const trimmed = code.trim();

  function join(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmed) return;
    router.push(`/sport-events/join/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form
      onSubmit={join}
      className={cn("flex items-center gap-2", variant === "link" && "flex-wrap")}
    >
      <label htmlFor={`join-code-input-${variant}`} className="sr-only">
        Invite code
      </label>
      {variant === "link" ? (
        <span className="inline-flex items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
          <Ticket size={14} aria-hidden="true" />
          Have a code?
        </span>
      ) : null}
      <input
        id={`join-code-input-${variant}`}
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        placeholder="Invite code"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="min-h-11 w-36 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-base font-medium text-on-surface transition-colors placeholder:text-secondary/70 hover:border-outline focus:border-outline focus:outline-none sm:text-sm"
      />
      <button
        type="submit"
        disabled={!trimmed}
        className="inline-flex min-h-11 items-center rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-surface transition-colors hover:border-outline disabled:opacity-50"
      >
        Join
      </button>
    </form>
  );
}
