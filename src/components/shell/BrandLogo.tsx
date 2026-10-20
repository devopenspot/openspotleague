import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export const DEFAULT_BRAND_LOGO = "/logo.png";

export interface BrandLogoProps {
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
  image?: string;
  src?: string;
  alt?: string;
}

export function BrandLogo({
  onClick,
  size = "md",
  className,
  image,
  src,
  alt = "",
}: BrandLogoProps) {
  const isLink = !onClick;
  const imageSize = size === "sm" ? 32 : 40;
  const logoSrc = image ?? src ?? DEFAULT_BRAND_LOGO;

  const content = (
    <Image
      src={logoSrc}
      alt={alt}
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
