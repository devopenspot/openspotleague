import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingDialog } from "./OnboardingDialog";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUIStore } from "@/stores/ui-store";

const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/games",
  useSearchParams: () => ({ toString: () => "" }),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => auth.user,
}));

vi.mock("@/components/feedback/Overlay", () => ({
  Overlay: ({
    isOpen,
    labelledBy,
    children,
  }: {
    isOpen: boolean;
    labelledBy: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-labelledby={labelledBy}>
        {children}
      </div>
    ) : null,
}));

describe("OnboardingDialog", () => {
  beforeEach(() => {
    auth.user = null;
    localStorage.clear();
    usePreferencesStore.getState().reset();
    usePreferencesStore.getState().setHydrationStatus("ready");
    useUIStore.getState().closeOnboarding();
    vi.unstubAllGlobals();
  });

  it("saves guest preferences locally and resumes the pending destination", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    useUIStore.getState().tryRun(action, "/saved");

    render(<OnboardingDialog />);

    await user.click(screen.getByRole("radio", { name: "BMX" }));
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(usePreferencesStore.getState()).toMatchObject({
      preferredSport: "BMX",
      preferenceAccountId: null,
      hasLocalChanges: true,
    });
    expect(action).toHaveBeenCalledOnce();
    expect(useUIStore.getState().isOnboardingOpen).toBe(false);
  });

  it("uses the pending destination for the guest sign-in link", () => {
    useUIStore.getState().tryRun(vi.fn(), "/map?saved=1");

    render(<OnboardingDialog />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fmap%3Fsaved%3D1",
    );
  });

  it("writes the canonical signed-in response to local storage after saving", async () => {
    const user = userEvent.setup();
    auth.user = { id: "user-1" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          distanceUnit: "km",
          temperatureUnit: "F",
          disciplineSlug: "bmx",
        }),
      }),
    );
    useUIStore.getState().openPreferences();

    render(<OnboardingDialog />);

    await user.click(screen.getByRole("radio", { name: "Kilometers" }));
    await user.click(screen.getByRole("radio", { name: "Fahrenheit" }));
    await user.click(screen.getByRole("radio", { name: "BMX" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(usePreferencesStore.getState()).toMatchObject({
        distanceUnit: "km",
        temperatureUnit: "F",
        preferredSport: "BMX",
        preferenceAccountId: "user-1",
        hasLocalChanges: false,
      }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          distanceUnit: "km",
          temperatureUnit: "F",
          disciplineSlug: "bmx",
        }),
      }),
    );
    expect(localStorage.getItem("openspot-preferences")).toContain('"preferredSport":"BMX"');
    expect(useUIStore.getState().isOnboardingOpen).toBe(false);
  });

  it("closes edit mode without changing the current route", async () => {
    const user = userEvent.setup();
    useUIStore.getState().openPreferences();

    render(<OnboardingDialog />);
    await user.click(screen.getByRole("button", { name: "Back to current page" }));

    expect(useUIStore.getState().isOnboardingOpen).toBe(false);
  });
});
