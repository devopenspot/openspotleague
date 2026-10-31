const PATTERNS: Record<"tap" | "undo", VibratePattern> = {
  tap: 15,
  undo: [10, 40, 10],
};

/**
 * Best-effort vibration. iOS Safari has no web vibration API, so there the
 * instant visual state is the feedback.
 */
export function haptic(pattern: keyof typeof PATTERNS) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Some embedded browsers throw when vibration is blocked.
  }
}
