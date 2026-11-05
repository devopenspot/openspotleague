"use client";

/**
 * Invite landing for shared league links/QR (`/league/join/[code]`).
 * Public preview → sign-in gate for guests → join confirm for riders →
 * redirect to the event page.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Rocket } from "lucide-react";
import {
  alertClass,
  BODY,
  CARD,
  controlClass,
  EYEBROW,
  PAGE_TITLE,
  pageContainer,
} from "@/components/ui/recipes";
import { useUser } from "@/lib/contexts/user-context";
import { SignInLink } from "@/components/shell/SignInLink";
import { formatEventTimeInZone, roleLabel } from "@/lib/league/ui-state";
import {
  DEFAULT_MUTATION_TIMEOUT_MS,
  DEFAULT_READ_TIMEOUT_MS,
  fetchWithTimeout,
} from "@/lib/utils/fetch-timeout";
import { buildContestDetailUrl, buildContestJoinUrl } from "@/lib/league/urls";
import { ROUTES } from "@/lib/navigation/nav";

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
      try {
        const response = await fetchWithTimeout(`/api/league/invites/${code}`, {
          cache: "no-store",
          timeoutMs: DEFAULT_READ_TIMEOUT_MS,
        });
        if (cancelled) return;
        if (response.ok) {
          const data = (await response.json()) as InvitePreview;
          if (cancelled) return;
          setPreview(data);
        } else {
          setError("This invite could not be found.");
        }
      } catch {
        if (cancelled) return;
        setError("This invite could not be loaded. Check your connection and try again.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
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
      const response = await fetchWithTimeout("/api/league/join", {
        method: "POST",
        timeoutMs: DEFAULT_MUTATION_TIMEOUT_MS,
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
      router.push(buildContestDetailUrl(preview.eventSlug));
    } catch {
      setError("Joining did not work. Check your connection and try again.");
      setJoinState("idle");
    }
  }

  if (loading) {
    return (
      <div className={pageContainer("3xl")} aria-busy="true">
        <p className="sr-only">Loading invite…</p>
        <div
          aria-hidden="true"
          className="mx-auto h-64 max-w-md animate-pulse rounded-container bg-white/20"
        />
      </div>
    );
  }

  return (
    <div className={pageContainer("3xl")}>
      <div className={`mx-auto max-w-md text-on-surface ${CARD} sm:p-6`}>
        {preview ? (
          <>
            <p className={EYEBROW}>League invite</p>
            <h1 className={`mt-1 ${PAGE_TITLE}`}>{preview.eventName}</h1>
            <ul className={`mt-4 flex flex-col gap-2 ${BODY}`}>
              <li className="flex items-center gap-2">
                <CalendarDays size={14} aria-hidden="true" className="text-secondary" />
                {formatEventTimeInZone(preview.eventStartAt, preview.timezone)}
              </li>
              <li className="flex items-center gap-2">
                <MapPin size={14} aria-hidden="true" className="text-secondary" />
                {preview.city}
              </li>
              <li className="flex items-center gap-2">
                <Rocket size={14} aria-hidden="true" className="text-secondary" />
                Invited as {roleLabel(preview.role)}
              </li>
            </ul>

            {!preview.usable ? (
              <div role="alert" className={`mt-5 text-sm ${alertClass("error")}`}>
                {preview.reason ?? "This invite is no longer usable."}
              </div>
            ) : error ? (
              <div role="alert" className={`mt-5 text-sm ${alertClass("error")}`}>
                {error}
              </div>
            ) : joinState === "done" ? (
              <p className={`mt-5 text-sm ${alertClass("neutral")}`} role="status">
                You&apos;re in — taking you to the event…
              </p>
            ) : user ? (
              <button
                type="button"
                disabled={joinState === "busy"}
                aria-busy={joinState === "busy" || undefined}
                onClick={() => void join()}
                className={`mt-5 w-full ${controlClass("primary")}`}
              >
                {joinState === "busy" ? "Joining…" : "Join the event"}
              </button>
            ) : (
              <div className="mt-2">
                <SignInLink
                  variant="dialog"
                  next={buildContestJoinUrl(code)}
                />
                <p className="mt-2 text-center text-xs text-secondary">
                  Sign in to join as {roleLabel(preview.role)}.
                </p>
              </div>
            )}
          </>
        ) : (
          <div role="alert" className={`text-sm ${alertClass("error")}`}>
            {error ?? "This invite could not be found."}
          </div>
        )}
        <Link
          href={ROUTES.league}
          className={`mt-5 w-full ${controlClass("outline")}`}
        >
          All contests
        </Link>
      </div>
    </div>
  );
}
