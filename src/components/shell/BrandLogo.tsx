import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface BrandLogoProps {
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function BrandLogo({ onClick, size = "md", className }: BrandLogoProps) {
  const isLink = !onClick;
  const imageSize = size === "sm" ? 32 : 40;
  const content = (
    <Image
      src="/favicon.png"
      alt=""
      width={imageSize}
      height={imageSize}
      className={"block shrink-0 object-contain h-16 w-16 -my-6"}
      priority={size === "md"}
    />
  );

  if (isLink) {
    return (
      <Link
        id={size === "md" ? "brand-logo" : undefined}
        href="/"
        aria-label="Open Spot — home"
        className={cn("flex items-center space-x-2 rounded-full", className)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      id={size === "md" ? "brand-logo" : undefined}
      type="button"
      onClick={onClick}
      aria-label="Open Spot home"
      className={cn(
        "flex items-center space-x-2 rounded-full cursor-pointer",
        className,
      )}
    >
      {content}
    </button>
  );
}
