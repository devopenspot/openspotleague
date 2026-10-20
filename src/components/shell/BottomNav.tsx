"use client";

import { useRouter } from "next/navigation";
import { AppNavList } from "@/components/shell/AppNavList";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";
import { MAIN_CONTENT_ID } from "@/lib/config/constants";

export function BottomNav() {
  const router = useRouter();
  const user = useUser();
  const { count: savedCount } = useSavedSpots(user?.id ?? null);

  const handleSelect = (path: string) => {
    router.push(path);
  };

  return (
    <div className="[&_#mobile-nav]:border-t [&_#mobile-nav]:border-wire-border [&_#mobile-nav]:bg-primary [&_#mobile-nav_[data-nav-tab]]:text-wire-muted hover:[&_#mobile-nav_[data-nav-tab]]:text-on-wire [&_#mobile-nav_[data-nav-tab][aria-selected=true]]:text-on-primary focus-visible:[&_#mobile-nav_[data-nav-tab]]:ring-white focus-visible:[&_#mobile-nav_[data-nav-tab]]:ring-offset-wire [&_#mobile-nav_[aria-label*='spots saved']]:bg-on-wire [&_#mobile-nav_[aria-label*='spots saved']]:text-primary">
      <AppNavList
        variant="mobile-tab"
        savedCount={savedCount}
        controlsId={MAIN_CONTENT_ID}
        onSelect={handleSelect}
      />
    </div>
  );
}
