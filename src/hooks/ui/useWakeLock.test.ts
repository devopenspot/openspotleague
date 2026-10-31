import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWakeLock } from "@/hooks/ui/useWakeLock";

function installWakeLock() {
  const sentinels: { release: ReturnType<typeof vi.fn>; fire: () => void }[] = [];
  const request = vi.fn(async () => {
    const listeners: (() => void)[] = [];
    const sentinel = {
      release: vi.fn(async () => undefined),
      addEventListener: (_: string, listener: () => void) => {
        listeners.push(listener);
      },
      fire: () => listeners.forEach((listener) => listener()),
    };
    sentinels.push(sentinel);
    return sentinel;
  });
  Object.defineProperty(navigator, "wakeLock", {
    configurable: true,
    value: { request },
  });
  return { request, sentinels };
}

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
});

describe("useWakeLock", () => {
  it("does nothing when the browser has no wake lock", () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("does not request a lock while disabled", () => {
    const { request } = installWakeLock();
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it("holds a lock while enabled and releases it afterwards", async () => {
    const { request, sentinels } = installWakeLock();
    const { rerender } = renderHook(({ on }) => useWakeLock(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(sentinels).toHaveLength(1));
    expect(request).toHaveBeenCalledWith("screen");

    rerender({ on: false });

    expect(sentinels[0]?.release).toHaveBeenCalledOnce();
  });

  it("requests the lock again after the page comes back", async () => {
    const { request, sentinels } = installWakeLock();
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(sentinels).toHaveLength(1));

    act(() => sentinels[0]?.fire());
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  });

  it("survives a refused request", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => undefined);
    expect(() => unmount()).not.toThrow();
  });
});
