"use client";

/**
 * Invite landing for shared league links/QR (`/sport-events/join/[code]`).
 * Public preview → sign-in gate for guests → join confirm for riders →
 * redirect to the event page.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Rocket } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useUser } from "@/lib/contexts/user-context";
import { SignInLink } from "@/components/shell/SignInLink";
import { formatEventTimeInZone, roleLabel } from "@/lib/league/ui-state";

interface InvitePreview {
  eventSlug: string;
  eventName: string;
  eventStartAt: string;
  timezone: string;
  city: string;
  role: string;
  usable: boolean;
  reason: string | null;
}

export function JoinWithInvite({ code }: { code: string }) {
  const router = useRouter();
  const user = useUser();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinState, setJoinState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch(`/api/league/invites/${code}`, {
        cache: "no-store",
      });
      if (cancelled) return;
      if (response.ok) {
        setPreview((await response.json()) as InvitePreview);
      } else {
        setError("This invite could not be found.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function join() {
    if (!preview) return;
    setJoinState("busy");
    setError(null);
    try {
      const response = await fetch("/api/league/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const raw = await response.json().catch(() => null);
      if (!response.ok) {
        setError(raw?.message ?? raw?.error ?? "Joining did not work.");
        setJoinState("idle");
        return;
      }
      setJoinState("done");
      router.push(`/sport-events/${preview.eventSlug}`);
    } catch {
      setError("Joining did not work. Check your connection and try again.");
      setJoinState("idle");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-md px-5 py-16">
        <div
          className="h-32  rounded-lg bg-surface-container"
          aria-hidden="true"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-5 py-12">
      <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-6">
        {preview ? (
          <>
            <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-secondary">
              League invite
            </p>
            <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-on-surface">
              {preview.eventName}
            </h1>
            <ul className="mt-4 flex flex-col gap-2 text-sm text-secondary">
              <li className="flex items-center gap-2">
                <CalendarDays size={14} aria-hidden="true" />
                {formatEventTimeInZone(preview.eventStartAt, preview.timezone)}
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={14} aria-hidden="true" />
                {preview.city}
              </li>
              <li className="flex items-center gap-2">
                <Rocket size={14} aria-hidden="true" />
                Invited as {roleLabel(preview.role)}
              </li>
            </ul>

            {!preview.usable ? (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
              >
                {preview.reason ?? "This invite is no longer usable."}
              </div>
            ) : error ? (
              <div
                role="alert"
                className="mt-5 rounded-lg border border-error/30 bg-error-container/30 p-4 text-sm text-error"
              >
                {error}
              </div>
            ) : joinState === "done" ? (
              <p
                className="mt-5 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-sm text-on-surface"
                role="status"
              >
                You&apos;re in — taking you to the event…
              </p>
            ) : user ? (
              <button
                type="button"
                disabled={joinState === "busy"}
                onClick={() => void join()}
                className={cn(
                  "mt-5 min-h-11 w-full rounded-full bg-primary font-display text-xs font-semibold uppercase tracking-[0.08em] text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50",
                )}
              >
                {joinState === "busy" ? "Joining…" : "Join the event"}
              </button>
            ) : (
              <div className="mt-5">
                <SignInLink
                  variant="drawer"
                  next={`/sport-events/join/${code}`}
                  className="!mt-0"
                />
                <p className="mt-2 text-center text-xs text-secondary">
                  Sign in to join as {roleLabel(preview.role)}.
                </p>
              </div>
            )}
          </>
        ) : (
          <div role="alert" className="text-sm text-error">
            {error ?? "This invite could not be found."}
          </div>
        )}
        <Link
          href="/sport-events"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full border border-outline-variant px-4 font-display text-xs font-semibold uppercase tracking-[0.08em] text-secondary transition-colors hover:border-outline hover:text-on-surface"
        >
          All events
        </Link>
      </div>
    </main>
  );
}
