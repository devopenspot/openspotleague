import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const navigation = vi.hoisted(() => ({
  params: new URLSearchParams("next=%2Fmap%3Fsaved%3D1"),
}));
const pushMock = vi.hoisted(() => vi.fn());
const showToastMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => navigation.params,
}));

vi.mock("@/hooks/ui/useToast", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams("next=%2Fmap%3Fsaved%3D1");
    pushMock.mockReset();
    showToastMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("sends the complete intended destination to the sign-in endpoint", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Sign-in unavailable" }),
      }),
    );

    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Continue with Google/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/signin/google",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ next: "/map?saved=1" }),
        }),
      ),
    );
    expect(showToastMock).toHaveBeenCalledWith("Sign-in unavailable", "error");
  });

  it("falls back to the root for an unsafe destination", async () => {
    const user = userEvent.setup();
    navigation.params = new URLSearchParams("next=https%3A%2F%2Fevil.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Sign-in unavailable" }),
      }),
    );

    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /Continue with Google/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/signin/google",
        expect.objectContaining({ body: JSON.stringify({ next: "/" }) }),
      ),
    );
  });
});
