import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinByCodeEntry } from "./JoinByCodeEntry";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/sport-events",
}));

beforeEach(() => {
  push.mockReset();
});

describe("JoinByCodeEntry", () => {
  it("opens the dialog when clicking Join with code and shows an error on empty submit", async () => {
    render(<JoinByCodeEntry />);
    const trigger = screen.getByRole("button", { name: /join with code/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /^join$/i });
    await userEvent.click(submitBtn);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an invite code to join an event.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to the invite preview with a trimmed, case-preserved code and closes the dialog", async () => {
    render(<JoinByCodeEntry />);
    await userEvent.click(
      screen.getByRole("button", { name: /join with code/i }),
    );

    const input = screen.getByLabelText("Enter an event invite code");
    await userEvent.type(input, "  abcDEF123456  ");
    await userEvent.click(screen.getByRole("button", { name: /^join$/i }));

    expect(push).toHaveBeenCalledWith("/sport-events/join/abcDEF123456");
  });

  it("shows an invalid link alert when a foreign non-event URL is submitted", async () => {
    render(<JoinByCodeEntry />);
    await userEvent.click(
      screen.getByRole("button", { name: /join with code/i }),
    );

    const input = screen.getByLabelText("Enter an event invite code");
    await userEvent.type(input, "https://evil.example/login");
    await userEvent.click(screen.getByRole("button", { name: /^join$/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "That doesn't look like an event invite link. Try the invite code instead.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("reads from clipboard and navigates when Paste is clicked", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: {
        readText: vi
          .fn()
          .mockResolvedValue(
            "https://openspotleague.com/sport-events/join/pasteCode99",
          ),
      },
      configurable: true,
    });

    render(<JoinByCodeEntry variant="link" />);
    await userEvent.click(
      screen.getByRole("button", { name: /join with code/i }),
    );

    const pasteBtn = await waitFor(() =>
      screen.getByRole("button", { name: /paste/i }),
    );
    await userEvent.click(pasteBtn);

    expect(push).toHaveBeenCalledWith("/sport-events/join/pasteCode99");
  });
});
