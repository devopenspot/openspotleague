import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { usePreferencesStore } from "@/stores/preferences-store"

type PendingAction = () => void
export type PreferenceDialogMode = "onboarding" | "edit"

interface UIState {
  isSearchOpen: boolean
  isDrawerOpen: boolean
  isOnboardingOpen: boolean
  preferenceDialogMode: PreferenceDialogMode
  pendingOnboardingAction: PendingAction | null
  pendingOnboardingNext: string | null
  headerImage: string | null
  setHeaderImage: (image: string | null) => void
  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
  /**
   * Run `action` if a sport preference exists, otherwise open the onboarding
   * dialog and resume `action` after the user submits.
   */
  tryRun: (action: () => void, next?: string) => void
  resolvePendingOnboarding: () => void
  /** Alias kept for callers that semantically want to open the search. */
  tryOpenSearch: () => void
  openOnboarding: (mode?: PreferenceDialogMode) => void
  openPreferences: () => void
  closeOnboarding: () => void
  openDrawer: () => void
  closeDrawer: () => void
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      isSearchOpen: false,
      isDrawerOpen: false,
      isOnboardingOpen: false,
      preferenceDialogMode: "onboarding",
      pendingOnboardingAction: null,
      pendingOnboardingNext: null,
      headerImage: null,
      setHeaderImage: (image) => set({ headerImage: image }),
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),
      toggleSearch: () => set((s) => ({ isSearchOpen: !s.isSearchOpen })),
      tryRun: (action, next) => {
        const { hydrationStatus, preferredSport } = usePreferencesStore.getState()
        if (hydrationStatus === "idle" || hydrationStatus === "loading") {
          set({
            pendingOnboardingAction: action,
            pendingOnboardingNext: next ?? null,
          })
          return
        }
        if (preferredSport !== null) {
          action()
          return
        }
        set({
          pendingOnboardingAction: action,
          pendingOnboardingNext: next ?? null,
          isOnboardingOpen: true,
          preferenceDialogMode: "onboarding",
        })
      },
      resolvePendingOnboarding: () => {
        const { pendingOnboardingAction } = get()
        if (!pendingOnboardingAction) return

        const { hydrationStatus, preferredSport } = usePreferencesStore.getState()
        if (hydrationStatus === "idle" || hydrationStatus === "loading") return

        if (preferredSport !== null) {
          set({
            pendingOnboardingAction: null,
            pendingOnboardingNext: null,
          })
          pendingOnboardingAction()
          return
        }

        set({
          isOnboardingOpen: true,
          preferenceDialogMode: "onboarding",
        })
      },
      tryOpenSearch: () => {
        set({ isSearchOpen: true })
      },
      openOnboarding: (preferenceDialogMode = "onboarding") =>
        set({ isOnboardingOpen: true, preferenceDialogMode }),
      openPreferences: () =>
        set({ isOnboardingOpen: true, preferenceDialogMode: "edit" }),
      closeOnboarding: () =>
        set({
          isOnboardingOpen: false,
          pendingOnboardingAction: null,
          pendingOnboardingNext: null,
        }),
      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
    }),
    { name: "UIStore", enabled: process.env.NODE_ENV === "development" },
  ),
)
