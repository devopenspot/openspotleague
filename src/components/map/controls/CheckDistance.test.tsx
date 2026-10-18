import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TestLocation {
  lat: number;
  lon: number;
  accuracy: number;
}

const { locationState, clearLocationMock, showToastMock } = vi.hoisted(() => ({
  locationState: {
    status: "denied",
    location: null as TestLocation | null,
    error: null,
    request: vi.fn(),
  },
  clearLocationMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("@/hooks/map/useUserLocation", () => ({
  useUserLocation: () => locationState,
}));

vi.mock("@/components/map/hooks/use-map-actions", () => ({
  useMapActions: () => ({
    clearLocationAndNearby: clearLocationMock,
  }),
}));

vi.mock("@/hooks/ui/useToast", () => ({
  showToast: showToastMock,
}));

import { CheckDistance } from "@/components/map/controls/CheckDistance";

beforeEach(() => {
  vi.clearAllMocks();
  locationState.status = "denied";
  locationState.location = null;
  locationState.error = null;
  locationState.request.mockResolvedValue("denied");
});

describe("CheckDistance", () => {
  it("lets the browser decide whether a blocked permission can be retried", async () => {
    const user = userEvent.setup();
    render(<CheckDistance />);

    const button = screen.getByRole("button", {
      name: /location is blocked/i,
    });
    await user.click(button);

    expect(locationState.request).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(
      "Location is blocked. Allow location in your browser settings, close this tab and open again, then tap Try again.",
      "error",
    );
    expect(clearLocationMock).not.toHaveBeenCalled();
  });

  it("clears app location without attempting to revoke browser permission", async () => {
    locationState.status = "granted";
    locationState.location = {
      lat: 40.4168,
      lon: -3.7038,
      accuracy: 12,
    };
    const user = userEvent.setup();
    render(<CheckDistance />);

    await user.click(
      screen.getByRole("button", { name: /stop using location/i }),
    );

    expect(clearLocationMock).toHaveBeenCalledTimes(1);
    expect(showToastMock).toHaveBeenCalledWith(
      "Location cleared — showing global grid.",
      "info",
    );
  });
});
