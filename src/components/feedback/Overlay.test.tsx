import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Overlay } from "./Overlay";

function OverlayHarness({
  initialFocus,
}: {
  initialFocus?: "first" | "container";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open dialog
      </button>
      <Overlay
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        labelledBy="dialog-title"
        initialFocus={initialFocus}
      >
        <h2 id="dialog-title">Dialog title</h2>
        <input aria-label="Dialog input" />
      </Overlay>
    </>
  );
}

describe("Overlay", () => {
  it("focuses the first focusable element by default", () => {
    render(<OverlayHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("textbox", { name: "Dialog input" })).toHaveFocus();
  });

  it("can focus the dialog container instead of a form control", () => {
    render(<OverlayHarness initialFocus="container" />);

    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(screen.getByRole("dialog", { name: "Dialog title" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Dialog input" })).not.toHaveFocus();
  });
});
