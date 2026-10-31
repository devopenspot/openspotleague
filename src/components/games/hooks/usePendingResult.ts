"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Result } from "@/components/games/layout/header-state";
import { showToast } from "@/hooks/ui/useToast";
import type { GameState } from "@/lib/schemas/game";
import { haptic } from "@/lib/utils/haptics";

export const RESULT_UNDO_MS = 4000;
/** A wrong result in solo only changes the tally, so it can move faster. */
export const SOLO_RESULT_UNDO_MS = 2000;

export type ResultKind = "challenge" | "attempt";

export type PendingResult = {
  roundId: string;
  result: Result;
  kind: ResultKind;
  status: "counting" | "sending" | "unsent";
  undoMs: number;
};

/** `unsent` means no request reached the server, so it's safe to send again. */
export type ResultSubmission = "sent" | "unsent";

/** Whether the server state already reflects this result. */
export function resultWasApplied(
  game: GameState | null,
  entry: Pick<PendingResult, "roundId" | "kind">,
): boolean {
  if (!game) return false;
  const round = game.currentRound;
  if (!round || round.id !== entry.roundId) return true;
  if (entry.kind === "challenge") return round.status !== "challenge_open";
  return round.attempts.some(
    (attempt) => attempt.playerId === game.viewerPlayerId,
  );
}

/**
 * Holds a Landed/Failed tap for the undo window before anything is sent, so a
 * mis-tap never reaches the server. Hiding the page sends straight away: a
 * phone locked mid-countdown would otherwise lose the result.
 */
export function usePendingResult({
  roundId,
  submit,
  undoMs = RESULT_UNDO_MS,
}: {
  roundId: string | null;
  submit: (entry: PendingResult) => Promise<ResultSubmission>;
  undoMs?: number;
}) {
  const [pending, setPendingState] = useState<PendingResult | null>(null);
  const pendingRef = useRef<PendingResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitRef = useRef(submit);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const setPending = useCallback((next: PendingResult | null) => {
    pendingRef.current = next;
    setPendingState(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const send = useCallback(async () => {
    const entry = pendingRef.current;
    if (!entry || entry.status === "sending") return;
    clearTimer();
    const sending = { ...entry, status: "sending" as const };
    setPending(sending);
    let outcome: ResultSubmission;
    try {
      outcome = await submitRef.current(sending);
    } catch {
      outcome = "unsent";
    }
    if (pendingRef.current !== sending) return;
    setPending(outcome === "unsent" ? { ...sending, status: "unsent" } : null);
  }, [clearTimer, setPending]);

  const mark = useCallback(
    (result: Result, kind: ResultKind) => {
      if (!roundId || pendingRef.current) return;
      haptic("tap");
      setPending({ roundId, result, kind, status: "counting", undoMs });
      timerRef.current = setTimeout(() => void send(), undoMs);
    },
    [roundId, send, setPending, undoMs],
  );

  const undo = useCallback(() => {
    if (pendingRef.current?.status === "sending") return;
    clearTimer();
    haptic("undo");
    setPending(null);
  }, [clearTimer, setPending]);

  useEffect(() => {
    const entry = pendingRef.current;
    if (!entry || entry.roundId === roundId || entry.status === "sending") return;
    clearTimer();
    pendingRef.current = null;
    setPendingState(null);
    // Only a counting result is known to be unsent: an `unsent` request may have
    // committed after all, which is usually why the round moved on.
    if (entry.status === "counting") {
      showToast("The Round Moved On — Your Result Wasn't Sent.", "info");
    }
  }, [clearTimer, roundId]);

  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== "hidden") return;
      if (pendingRef.current?.status === "counting") void send();
    };
    document.addEventListener("visibilitychange", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      if (pendingRef.current?.status === "counting") void send();
      clearTimer();
    };
  }, [clearTimer, send]);

  return { pending, mark, undo, resend: send };
}
