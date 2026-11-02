"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { cn } from "@/lib/utils/cn";

type Variant = "header" | "drawer" | "app-header";

const BASE_CLASSES =
  "inline-flex items-center justify-center font-display font-bold uppercase";

const PILL_CLASSES =
  "tracking-widest transition-all rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-surface focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const VARIANT_CLASSES: Record<Variant, string> = {
  header: `${PILL_CLASSES} border border-outline text-on-surface hover:bg-surface-container text-[10px] px-3 py-1.5`,
  drawer: `${PILL_CLASSES} w-full mt-1.5 rounded-full border border-outline bg-on-surface text-surface hover:bg-on-surface/90 text-xs px-4 py-2.5`,
  // The shell header's dark bar, on every breakpoint.
  "app-header":
    "min-h-12 whitespace-nowrap rounded-lg border-2 border-on-primary bg-on-primary px-3 text-sm tracking-[0.04em] text-primary transition-[background-color,transform] hover:bg-on-primary/90 focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:translate-y-px sm:px-4",
};

interface SignInLinkProps {
  variant: Variant;
  className?: string;
  onClick?: () => void;
  next?: string;
}

export function SignInLink({ variant, className, onClick, next }: SignInLinkProps) {
  const user = useUser();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (user) return null;

  const currentPath =
    pathname && pathname !== "/login"
      ? `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
      : null;
  const target = next ?? currentPath;
  const search = target ? `?next=${encodeURIComponent(target)}` : "";

  return (
    <Link
      id={variant === "app-header" ? "nav-btn-login" : undefined}
      href={{ pathname: "/login", search }}
      onClick={onClick}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
    >
      Sign in
    </Link>
  );
}
