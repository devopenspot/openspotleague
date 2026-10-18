import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SportEventsTab } from "./SportEventsTab";

const { push, user } = vi.hoisted(() => ({
  push: vi.fn(),
  user: { current: null as null | { id: string; name: string; email: string } },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/sport-events",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/contexts/user-context", () => ({
  useUser: () => user.current,
}));

describe("SportEventsTab league entries", () => {
  it("hides the create CTA from guests but keeps join-by-code and My league", () => {
    user.current = null;
    render(<SportEventsTab featured={undefined} events={[]} />);
    expect(
      screen.queryByRole("link", { name: /create event/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /my league/i })).toHaveAttribute(
      "href",
      "/league",
    );
    expect(screen.getByLabelText("Invite code")).toBeInTheDocument();
  });

  it("shows the create CTA only for signed-in users", () => {
    user.current = { id: "u1", name: "Organizer", email: "u@x.dev" };
    render(<SportEventsTab featured={undefined} events={[]} />);
    expect(
      screen.getByRole("link", { name: /create event/i }),
    ).toHaveAttribute("href", "/league/new");
    expect(screen.getByRole("link", { name: /my league/i })).toBeInTheDocument();
  });
});
