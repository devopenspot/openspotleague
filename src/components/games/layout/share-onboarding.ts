const SHARE_ONBOARDING_STORAGE_PREFIX = "openspot:game-share-onboarding:v1:";

function shareOnboardingStorageKey(gameId: string) {
  return `${SHARE_ONBOARDING_STORAGE_PREFIX}${encodeURIComponent(gameId)}`;
}

export function hasSeenShareOnboarding(gameId: string) {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.localStorage.getItem(shareOnboardingStorageKey(gameId)) === "seen"
    );
  } catch {
    return false;
  }
}

export function markShareOnboardingSeen(gameId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(shareOnboardingStorageKey(gameId), "seen");
  } catch {
    // Private browsing and disabled storage should not block the game.
  }
}
