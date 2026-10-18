/**
 * Preserve-flag for map location/weather across spot-detail → map back-navigation.
 * Uses sessionStorage with history.state fallback and is safe in SSR / private mode.
 * Single source of truth — consumed by MapPageClient, MapShell, SpotDetailsContent, SearchOverlay.
 */
const KEY = "map-preserve-location";
const HISTORY_KEY = "mapPreserveLocation";

const NEARBY_KEY = "map-preserve-nearby";
const NEARBY_HISTORY_KEY = "mapPreserveNearby";

export function setMapPreserveLocation(): void {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // fallback to history.state
    try {
      const state = (history.state as Record<string, unknown> | null) ?? {};
      history.replaceState({ ...state, [HISTORY_KEY]: 1 }, "");
    } catch {
      // ignore - private mode / no history
    }
  }
}

export function consumeMapPreserveLocation(): boolean {
  // try sessionStorage first
  try {
    if (sessionStorage.getItem(KEY) === "1") {
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        // ignore
        void 0;
      }
      // also clear history.state if present
      try {
        const state = history.state as Record<string, unknown> | null;
        if (state && HISTORY_KEY in state) {
          const { [HISTORY_KEY]: _removed, ...rest } = state;
          history.replaceState(rest, "");
        }
      } catch {
        void 0;
      }
      return true;
    }
  } catch {
    void 0;
  }
  // fallback to history.state
  try {
    const state = history.state as Record<string, unknown> | null;
    if (state && state[HISTORY_KEY] === 1) {
      const { [HISTORY_KEY]: _removed, ...rest } = state ?? {};
      try {
        history.replaceState(rest, "");
      } catch {
        void 0;
      }
      return true;
    }
  } catch {
    void 0;
  }
  return false;
}

export function clearMapPreserveLocation(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    void 0;
  }
  try {
    const state = history.state as Record<string, unknown> | null;
    if (state && HISTORY_KEY in state) {
      const { [HISTORY_KEY]: _removed, ...rest } = state;
      history.replaceState(rest, "");
    }
  } catch {
    void 0;
  }
}

export function setMapPreserveNearbyEntry(): void {
  try {
    sessionStorage.setItem(NEARBY_KEY, "1");
  } catch {
    try {
      const state = (history.state as Record<string, unknown> | null) ?? {};
      history.replaceState({ ...state, [NEARBY_HISTORY_KEY]: 1 }, "");
    } catch {
      // ignore - private mode / no history
    }
  }
}

export function consumeMapPreserveNearbyEntry(): boolean {
  try {
    if (sessionStorage.getItem(NEARBY_KEY) === "1") {
      try {
        sessionStorage.removeItem(NEARBY_KEY);
      } catch {
        void 0;
      }
      try {
        const state = history.state as Record<string, unknown> | null;
        if (state && NEARBY_HISTORY_KEY in state) {
          const { [NEARBY_HISTORY_KEY]: _removed, ...rest } = state;
          history.replaceState(rest, "");
        }
      } catch {
        void 0;
      }
      return true;
    }
  } catch {
    void 0;
  }
  try {
    const state = history.state as Record<string, unknown> | null;
    if (state && state[NEARBY_HISTORY_KEY] === 1) {
      const { [NEARBY_HISTORY_KEY]: _removed, ...rest } = state ?? {};
      try {
        history.replaceState(rest, "");
      } catch {
        void 0;
      }
      return true;
    }
  } catch {
    void 0;
  }
  return false;
}

export function clearMapPreserveNearbyEntry(): void {
  try {
    sessionStorage.removeItem(NEARBY_KEY);
  } catch {
    void 0;
  }
  try {
    const state = history.state as Record<string, unknown> | null;
    if (state && NEARBY_HISTORY_KEY in state) {
      const { [NEARBY_HISTORY_KEY]: _removed, ...rest } = state;
      history.replaceState(rest, "");
    }
  } catch {
    void 0;
  }
}
