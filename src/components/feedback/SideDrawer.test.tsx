import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SideDrawer } from "./SideDrawer";

const navigation = vi.hoisted(() => ({ pathname: "/games" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open drawer
      </button>
      <SideDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        labelledBy="drawer-title"
        testId="drawer"
      >
        <h2 id="drawer-title">Drawer title</h2>
        <button type="button">Drawer action</button>
      </SideDrawer>
    </>
  );
}

function BottomDrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open bottom sheet
      </button>
      <SideDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        labelledBy="bottom-sheet-title"
        testId="bottom-sheet"
        side="bottom"
      >
        <h2 id="bottom-sheet-title">Bottom sheet</h2>
      </SideDrawer>
    </>
  );
}

function TopDrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open top drawer
      </button>
      <SideDrawer
        isOpen={open}
        onClose={() => setOpen(false)}
        labelledBy="top-drawer-title"
        testId="top-drawer"
        side="top"
      >
        <h2 id="top-drawer-title">Top drawer</h2>
      </SideDrawer>
    </>
  );
}

beforeEach(() => {
  navigation.pathname = "/games";
  document.body.style.overflow = "";
});

describe("SideDrawer", () => {
  it("provides modal semantics, locks scrolling, and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    const trigger = screen.getByRole("button", { name: "Open drawer" });

    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Drawer title" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Drawer action" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes from the backdrop", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    await user.click(screen.getByRole("button", { name: "Open drawer" }));

    const backdrop = screen.getByTestId("drawer").querySelector<HTMLElement>("[aria-hidden='true']");
    expect(backdrop).not.toBeNull();
    await user.click(backdrop!);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("supports bottom-sheet panels", async () => {
    const user = userEvent.setup();
    render(<BottomDrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Open bottom sheet" }));

    const dialog = screen.getByRole("dialog", { name: "Bottom sheet" });
    expect(dialog).toHaveClass("inset-x-0", "bottom-0");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("supports top-opening panels", async () => {
    const user = userEvent.setup();
    render(<TopDrawerHarness />);

    await user.click(screen.getByRole("button", { name: "Open top drawer" }));

    const dialog = screen.getByRole("dialog", { name: "Top drawer" });
    expect(dialog).toHaveClass("inset-x-0", "top-0");
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes only after the pathname changes", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <SideDrawer isOpen onClose={onClose} labelledBy="route-drawer-title">
        <h2 id="route-drawer-title">Route drawer</h2>
      </SideDrawer>,
    );

    expect(onClose).not.toHaveBeenCalled();
    navigation.pathname = "/games/new";
    rerender(
      <SideDrawer isOpen onClose={onClose} labelledBy="route-drawer-title">
        <h2 id="route-drawer-title">Route drawer</h2>
      </SideDrawer>,
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
