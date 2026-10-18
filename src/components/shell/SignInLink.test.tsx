import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SignInLink } from "./SignInLink";

const navigation = vi.hoisted(() => ({
  pathname: "/games",
  search: "share=ABC123",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => ({ toString: () => navigation.search }),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => null,
}));

describe("SignInLink", () => {
  it("preserves the current query string in the login destination", () => {
    render(<SignInLink variant="drawer" />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fgames%3Fshare%3DABC123",
    );
  });

  it("uses an explicit destination when onboarding owns the pending action", () => {
    render(<SignInLink variant="drawer" next="/map?saved=1" />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Fmap%3Fsaved%3D1",
    );
  });
});
