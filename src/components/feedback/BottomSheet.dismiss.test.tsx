import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type SnapHandler = (snap: number | string | null) => void;

let emitSnapChange: SnapHandler = () => undefined;

// The real Drawer needs a laid-out viewport to resolve a swipe, so the sequence
// it emits on a flick past peek is replayed here. See the note in BottomSheet.
vi.mock("@base-ui/react/drawer", () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Drawer: {
      Root: ({
        children,
        onSnapPointChange,
      }: {
        children: ReactNode;
        onSnapPointChange: SnapHandler;
      }) => {
        emitSnapChange = onSnapPointChange;
        return <>{children}</>;
      },
      Portal: Passthrough,
      Viewport: Passthrough,
      Popup: Passthrough,
      Content: Passthrough,
    },
  };
});

import { BottomSheet } from "@/components/feedback/BottomSheet";

describe("BottomSheet dismiss attempts", () => {
  it("lands on peek when a flick past peek is cancelled", () => {
    const onDetentChange = vi.fn();
    render(
      <BottomSheet
        label="Game controls"
        detent="full"
        onDetentChange={onDetentChange}
        peekHeight={132}
        handle="Your turn"
      />,
    );

    act(() => {
      emitSnapChange(null);
      emitSnapChange(0.92);
    });

    expect(onDetentChange).toHaveBeenCalledTimes(1);
    expect(onDetentChange).toHaveBeenCalledWith("peek", "user");
  });

  it("still follows a normal drag afterwards", () => {
    const onDetentChange = vi.fn();
    render(
      <BottomSheet
        label="Game controls"
        detent="peek"
        onDetentChange={onDetentChange}
        peekHeight={132}
        handle="Your turn"
      />,
    );

    act(() => {
      emitSnapChange(null);
      emitSnapChange("132px");
      emitSnapChange(0.55);
    });

    expect(onDetentChange).toHaveBeenLastCalledWith("half", "user");
  });
});
