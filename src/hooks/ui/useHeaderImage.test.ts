import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "@/stores/ui-store";
import { useHeaderImage } from "./useHeaderImage";

describe("useHeaderImage", () => {
  beforeEach(() => {
    useUIStore.getState().setHeaderImage(null);
  });

  it("sets the header image in ui-store on mount", () => {
    const { unmount } = renderHook(() => useHeaderImage("/custom-event.png"));

    expect(useUIStore.getState().headerImage).toBe("/custom-event.png");

    unmount();
    expect(useUIStore.getState().headerImage).toBeNull();
  });

  it("does not update store if image is null or undefined", () => {
    renderHook(() => useHeaderImage(undefined));
    expect(useUIStore.getState().headerImage).toBeNull();
  });

  it("updates store when image prop changes", () => {
    let currentImage = "/first.png";
    const { rerender, unmount } = renderHook(() => useHeaderImage(currentImage));

    expect(useUIStore.getState().headerImage).toBe("/first.png");

    currentImage = "/second.png";
    rerender();
    expect(useUIStore.getState().headerImage).toBe("/second.png");

    unmount();
    expect(useUIStore.getState().headerImage).toBeNull();
  });
});
