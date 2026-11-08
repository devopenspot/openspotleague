"use client";

import { useEffect, useState } from "react";
import type { ProfileTricks } from "@/lib/services/profile/profile";

export type ProfileTricksState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ProfileTricks };

/**
 * One fetch of /api/profile/tricks for the whole page: the Overview summary
 * and the Tricks tab read the same state instead of each refetching on mount.
 */
export function useProfileTricks(): ProfileTricksState {
  const [state, setState] = useState<ProfileTricksState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile/tricks", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("failed");
        return (await r.json()) as ProfileTricks;
      })
      .then((data) => setState({ status: "ready", data }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, []);

  return state;
}
