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
    <AppNavList
      variant="mobile-tab"
      savedCount={savedCount}
      controlsId={MAIN_CONTENT_ID}
      onSelect={handleSelect}
    />
  );
}
