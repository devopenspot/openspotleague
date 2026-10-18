"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { showToast } from "@/hooks/ui/useToast";

function isSafeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const errorParam = searchParams.get("error");
  const errorMessage =
    errorParam === "oauth"
      ? "Google sign-in was cancelled or failed. Try again."
      : null;

  const next = isSafeNext(searchParams.get("next"));

  const handleGoogleSignIn = () => {
    setLoading(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/signin/google", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ next }),
        });
        const data = (await res.json().catch(() => null)) as {
          url?: string;
          error?: string;
        } | null;
        if (!res.ok || !data?.url) {
          const message = data?.error ?? "Sign-in is not available right now.";
          showToast(message, "error");
          setLoading(false);
          return;
        }
        window.location.href = data.url;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Sign-in failed. Try again.";
        showToast(message, "error");
        setLoading(false);
      }
    });
  };

  const busy = pending || loading;

  return (
    <section
      id="login-tab"
      role="tabpanel"
      aria-labelledby="nav-btn-login"
      className="mx-2 md:mx-auto max-w-md animate-fade-in rounded-[16px] my-16 border border-outline-variant bg-surface-container-lowest px-5 py-8 sm:px-8 sm:py-10"
    >
      <h1 className="font-display text-[32px] font-bold leading-[1.2] tracking-[-0.02em] uppercase text-on-surface sm:text-5xl">
        Sign in
      </h1>
      <p className="mt-4 text-sm leading-6 text-on-surface-variant">
        Continue with your Google account. We only read your name, email, and
        profile photo — nothing else.
      </p>
      <p className="mt-3 text-sm leading-6 text-on-surface-variant">
        Signing in lets you save spots and access them across sessions, manage
        your rider account, and join Open Spot challenges.
      </p>

      {errorMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-[16px] border border-error/30 bg-error-container px-4 py-3 text-sm leading-6 text-on-error-container"
        >
          {errorMessage}
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-[9999px] border border-primary bg-primary px-6 py-3 text-sm font-bold tracking-[0.05em] text-on-primary uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        <span>{busy ? "Opening Google…" : "Continue with Google"}</span>
      </button>

      <p className="mt-4 text-center font-sans text-xs font-semibold tracking-[0.05em] text-secondary uppercase">
        One account. One click. You're in.
      </p>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="mt-8 inline-flex min-h-11 items-center rounded-[9999px] border border-outline-variant bg-surface-container-high px-4 py-3 font-sans text-xs font-semibold tracking-[0.05em] text-on-surface uppercase transition-colors hover:border-outline hover:bg-surface-container-highest"
      >
        Back to directory
      </button>
    </section>
  );
}

function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="shrink-0"
    >
      <path
        fill="#FFFFFF"
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.51h3.227c1.886-1.741 2.986-4.305 2.986-7.351z"
      />
      <path
        fill="#FFFFFF"
        fillOpacity="0.75"
        d="M12 22c2.7 0 4.964-.895 6.614-2.422l-3.227-2.51c-.895.6-2.04.955-3.387.955-2.605 0-4.81-1.76-5.595-4.122H3.064v2.59A9.997 9.997 0 0 0 12 22z"
      />
      <path
        fill="#FFFFFF"
        fillOpacity="0.5"
        d="M6.405 13.9A6.005 6.005 0 0 1 6.09 12c0-.66.114-1.3.314-1.9V7.51H3.064A9.997 9.997 0 0 0 2 12c0 1.614.386 3.14 1.064 4.49l3.341-2.59z"
      />
      <path
        fill="#FFFFFF"
        fillOpacity="0.85"
        d="M12 5.977c1.468 0 2.786.505 3.823 1.495l2.868-2.867C16.96 2.987 14.695 2 12 2 8.118 2 4.764 4.222 3.064 7.51l3.341 2.59C7.19 7.736 9.395 5.977 12 5.977z"
      />
    </svg>
  );
}
