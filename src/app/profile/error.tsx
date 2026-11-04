"use client";

import { useEffect } from "react";
import { log } from "@/lib/utils/log";
import { ProfileShell } from "@/components/profile/layout/ProfileShell";
import { CARD, controlClass, SECTION_TITLE } from "@/components/ui/recipes";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      log.error("Profile segment error", { digest: error.digest, message: error.message } as unknown as never);
    } catch {
      // Must not throw in error boundary
    }
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isChunkError =
      error.name === "ChunkLoadError" ||
      /Loading chunk [\d\w_-]+ failed/i.test(error.message) ||
      /Failed to fetch dynamically imported module/i.test(error.message) ||
      /Importing a module script failed/i.test(error.message);

    if (isChunkError) {
      const key = `osp_profile_chunk_reload_${error.digest || error.message}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <ProfileShell>
      <div role="alert" className={`${CARD} mx-auto my-6 max-w-md text-center sm:p-8`}>
        <h2 className={`${SECTION_TITLE} text-on-surface`}>Profile is off the grid</h2>
        <p className="mt-2 text-sm leading-5 text-on-surface-variant">{error.message || "Profile threw while rendering."}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className={controlClass("primary")}>
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className={controlClass("outline")}>
            Reload
          </button>
        </div>
      </div>
    </ProfileShell>
  );
}
