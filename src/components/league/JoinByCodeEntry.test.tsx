import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinByCodeEntry } from "./JoinByCodeEntry";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  push.mockReset();
});

describe("JoinByCodeEntry", () => {
  it("disables submit while the code is empty or whitespace-only", async () => {
    render(<JoinByCodeEntry />);
    const input = screen.getByLabelText("Invite code");
    const button = screen.getByRole("button", { name: "Join" });
    expect(button).toBeDisabled();
    await userEvent.type(input, "   ");
    expect(button).toBeDisabled();
  });

  it("navigates to the invite preview with a trimmed, case-preserved code", async () => {
    render(<JoinByCodeEntry />);
    const input = screen.getByLabelText("Invite code");
    await userEvent.type(input, "  abcDEF123456  ");
    const button = screen.getByRole("button", { name: "Join" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(push).toHaveBeenCalledWith("/sport-events/join/abcDEF123456");
  });

  it("link variant shows the Have a code? hint with the same input", () => {
    render(<JoinByCodeEntry variant="link" />);
    expect(screen.getByText("Have a code?")).toBeInTheDocument();
    expect(screen.getByLabelText("Invite code")).toBeInTheDocument();
  });
});
