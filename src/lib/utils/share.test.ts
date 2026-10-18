import { describe, expect, it, vi } from "vitest";
import { copyText, shareOrCopyUrl } from "./share";

describe("share helpers", () => {
  it("copies text when clipboard is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("https://open-spot.test/games/1")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://open-spot.test/games/1");
  });

  it("falls back to copying when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(shareOrCopyUrl("https://open-spot.test/games/1", "Game")).resolves.toBe("copied");
  });
});
