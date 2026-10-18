"use client";

import { useEffect, useState } from "react";
import { subscribeToLeagueEvent } from "@/lib/league/realtime";

/**
 * Console realtime: debounced state refetch on league event signals with a
 * transparent polling fallback. Returns the connection badge state.
 */
export function useLeagueRealtime(
  eventId: string | null,
  refresh: () => Promise<void>,
): "connected" | "reconnecting" {
  const [connection, setConnection] = useState<"connected" | "reconnecting">(
    "reconnecting",
  );

  useEffect(() => {
    if (!eventId) return;
    const controller = subscribeToLeagueEvent({
      eventId,
      refreshState: refresh,
      onConnectionChange: setConnection,
    });
    return () => controller.stop();
  }, [eventId, refresh]);

  return connection;
}
