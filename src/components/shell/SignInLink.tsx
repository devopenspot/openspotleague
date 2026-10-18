"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { cn } from "@/lib/utils/cn";

type Variant = "header" | "drawer";

const BASE_CLASSES =
  "inline-flex items-center justify-center font-display font-bold uppercase tracking-widest transition-all rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-on-surface focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface";

const VARIANT_CLASSES: Record<Variant, string> = {
  header:
    "border border-outline text-on-surface hover:bg-surface-container text-[10px] px-3 py-1.5",
  drawer:
    "w-full mt-1.5 rounded-full border border-outline bg-on-surface text-surface hover:bg-on-surface/90 text-xs px-4 py-2.5",
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
      id="nav-btn-login"
      href={{ pathname: "/login", search }}
      onClick={onClick}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], className)}
    >
      Sign in
    </Link>
  );
}
