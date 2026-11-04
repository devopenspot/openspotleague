"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useUser } from "@/lib/contexts/user-context";
import { cn } from "@/lib/utils/cn";
import { controlClass } from "@/components/ui/recipes";

type Variant = "header" | "drawer" | "app-header" | "app-drawer";

const VARIANT_CLASSES: Record<Variant, string> = {
  // Light surfaces.
  header: controlClass("outline", "sm"),
  drawer: `${controlClass("primary")} mt-1.5 w-full`,
  // The black shell chrome: header bar and the mobile drawer footer.
  "app-header": controlClass("onWire"),
  "app-drawer": `${controlClass("onWire")} w-full`,
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
      className={cn(VARIANT_CLASSES[variant], className)}
    >
      Sign in
    </Link>
  );
}
