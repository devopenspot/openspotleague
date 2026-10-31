import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  BottomSheet,
  nextSheetDetent,
  type SheetDetent,
} from "@/components/feedback/BottomSheet";

function Harness({
  onChange,
  initial = "peek",
}: {
  onChange?: (detent: SheetDetent) => void;
  initial?: SheetDetent;
}) {
  const [detent, setDetent] = useState<SheetDetent>(initial);
  return (
    <BottomSheet
      label="Game controls"
      detent={detent}
      onDetentChange={(next) => {
        onChange?.(next);
        setDetent(next);
      }}
      peekHeight={132}
      testId="sheet"
      handle={<span>Your turn</span>}
      footer={<button type="button">Landed</button>}
    >
      <p>Trick detail</p>
    </BottomSheet>
  );
}

describe("nextSheetDetent", () => {
  it("cycles peek, half, full and back to peek", () => {
    expect(nextSheetDetent("peek")).toBe("half");
    expect(nextSheetDetent("half")).toBe("full");
    expect(nextSheetDetent("full")).toBe("peek");
  });
});

describe("BottomSheet", () => {
  it("is a named, non-modal region with no dialog semantics", async () => {
    render(<Harness />);
    const sheet = await screen.findByRole("region", { name: "Game controls" });
    expect(sheet).toHaveAttribute("data-testid", "sheet");
    expect(sheet).not.toHaveAttribute("aria-modal");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("offers a non-drag way through every detent", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const handle = await screen.findByRole("button", { name: /your turn/i });
    expect(handle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(handle);
    expect(onChange).toHaveBeenLastCalledWith("half");
    expect(handle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(handle);
    expect(onChange).toHaveBeenLastCalledWith("full");

    fireEvent.click(handle);
    expect(onChange).toHaveBeenLastCalledWith("peek");
    expect(handle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the footer action available at peek", async () => {
    render(<Harness />);
    expect(
      await screen.findByRole("button", { name: "Landed" }),
    ).toBeInTheDocument();
  });

  it("does not close on Escape", async () => {
    render(<Harness initial="half" />);
    const sheet = await screen.findByRole("region", { name: "Game controls" });
    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(screen.getByRole("region", { name: "Game controls" })).toBeInTheDocument();
  });
});
