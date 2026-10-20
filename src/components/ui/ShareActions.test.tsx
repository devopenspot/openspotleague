import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ShareActions } from "./ShareActions";
import * as shortUrlUtils from "@/lib/utils/short-url";
import * as shareUtils from "@/lib/utils/share";

vi.mock("@/hooks/ui/useToast", () => ({
  showToast: vi.fn(),
}));

describe("ShareActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders share, copy link, and QR code buttons", async () => {
    await act(async () => {
      render(<ShareActions url="/spots/spot-1" />);
    });

    expect(screen.getByRole("button", { name: /share/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /qr code/i })).toBeDefined();
  });

  it("toggles the QR code overlay", async () => {
    await act(async () => {
      render(<ShareActions url="/spots/spot-1" />);
    });

    expect(screen.queryByLabelText(/qr code for shared link/i)).toBeNull();

    const qrButton = screen.getByRole("button", { name: /qr code/i });
    await act(async () => {
      fireEvent.click(qrButton);
    });

    expect(screen.getByLabelText(/qr code for shared link/i)).toBeDefined();

    await act(async () => {
      fireEvent.click(qrButton);
    });
    expect(screen.queryByLabelText(/qr code for shared link/i)).toBeNull();
  });

  it("asynchronously upgrades link and QR code to short URL", async () => {
    vi.spyOn(shortUrlUtils, "getOrFetchShortUrl").mockResolvedValueOnce(
      "https://openspotleague.com/s/7xK9q2A",
    );

    await act(async () => {
      render(<ShareActions url="/spots/spot-1" />);
    });

    const qrButton = screen.getByRole("button", { name: /qr code/i });
    await act(async () => {
      fireEvent.click(qrButton);
    });

    await waitFor(() => {
      const qrContainer = screen.getByLabelText(/qr code for shared link/i);
      expect(qrContainer).toBeDefined();
    });
  });

  it("calls shareOrCopyUrl with the active URL on share click", async () => {
    const shareSpy = vi
      .spyOn(shareUtils, "shareOrCopyUrl")
      .mockResolvedValueOnce("copied");
    vi.spyOn(shortUrlUtils, "getOrFetchShortUrl").mockResolvedValueOnce(
      "https://openspotleague.com/s/7xK9q2A",
    );

    await act(async () => {
      render(<ShareActions url="/spots/spot-1" title="Spot 1" />);
    });

    await waitFor(() => {
      expect(shortUrlUtils.getOrFetchShortUrl).toHaveBeenCalledWith(
        "/spots/spot-1",
        "Spot 1",
      );
    });

    const shareButton = screen.getByRole("button", { name: /share/i });
    await act(async () => {
      fireEvent.click(shareButton);
    });

    expect(shareSpy).toHaveBeenCalledWith(
      "https://openspotleague.com/s/7xK9q2A",
      "Spot 1",
    );
  });

  it("copies crew code when code prop is provided", async () => {
    const copySpy = vi.spyOn(shareUtils, "copyText").mockResolvedValueOnce(true);

    await act(async () => {
      render(<ShareActions url="/games/join/CREW1" code="CREW1" />);
    });

    const copyCodeButton = screen.getByRole("button", { name: /copy code/i });
    await act(async () => {
      fireEvent.click(copyCodeButton);
    });

    expect(copySpy).toHaveBeenCalledWith("CREW1");
  });
});
