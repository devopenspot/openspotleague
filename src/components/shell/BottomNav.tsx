"use client";

import { useRouter } from "next/navigation";
import { AppNavList } from "@/components/shell/AppNavList";
import { useSavedSpots } from "@/hooks/data/useSavedSpots";
import { useUser } from "@/lib/contexts/user-context";

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
      onSelect={handleSelect}
    />
  );
}
