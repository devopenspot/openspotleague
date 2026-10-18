import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUserLocation } from "./useUserLocation";
import {
  DEFAULT_NEARBY_RADIUS_MI,
  useUserLocationStore,
} from "@/stores/user-location-store";

interface MockGeolocation {
  getCurrentPosition: ReturnType<typeof vi.fn>;
}

let geolocation: MockGeolocation;
let geolocationDescriptor: PropertyDescriptor | undefined;
let secureContextDescriptor: PropertyDescriptor | undefined;

function defineBrowserMocks() {
  geolocation = {
    getCurrentPosition: vi.fn(),
  };

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: geolocation,
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
}

beforeEach(() => {
  geolocationDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "geolocation",
  );
  secureContextDescriptor = Object.getOwnPropertyDescriptor(
    window,
    "isSecureContext",
  );
  useUserLocationStore.setState({
    status: "idle",
    location: null,
    error: null,
    radiusMiles: DEFAULT_NEARBY_RADIUS_MI,
  });
  defineBrowserMocks();
});

afterEach(() => {
  cleanup();
  if (geolocationDescriptor) {
    Object.defineProperty(navigator, "geolocation", geolocationDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "geolocation");
  }
  if (secureContextDescriptor) {
    Object.defineProperty(window, "isSecureContext", secureContextDescriptor);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
});

describe("useUserLocation", () => {
  it("requests a position and records it as granted", async () => {
    geolocation.getCurrentPosition.mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.4168,
          longitude: -3.7038,
          accuracy: 12,
        } as GeolocationCoordinates,
      });
    });

    const { result } = renderHook(() => useUserLocation());

    await act(async () => {
      await expect(result.current.request()).resolves.toBe("granted");
    });

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(useUserLocationStore.getState()).toMatchObject({
      status: "granted",
      location: { lat: 40.4168, lon: -3.7038, accuracy: 12 },
    });
  });

  it("allows an explicit retry after the browser previously denied access", async () => {
    geolocation.getCurrentPosition
      .mockImplementationOnce((_, reject) => {
        reject({ code: 1, PERMISSION_DENIED: 1, TIMEOUT: 3 });
      })
      .mockImplementationOnce((success) => {
        success({
          coords: {
            latitude: 40.4168,
            longitude: -3.7038,
            accuracy: 12,
          } as GeolocationCoordinates,
        });
      });

    const { result } = renderHook(() => useUserLocation());

    await act(async () => {
      await expect(result.current.request()).resolves.toBe("denied");
    });
    expect(useUserLocationStore.getState().status).toBe("denied");

    await act(async () => {
      await expect(result.current.request()).resolves.toBe("granted");
    });

    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(useUserLocationStore.getState()).toMatchObject({
      status: "granted",
      location: { lat: 40.4168, lon: -3.7038, accuracy: 12 },
    });
  });

  it("clears app location without changing browser permission", () => {
    useUserLocationStore.getState().setGranted({
      lat: 40.4168,
      lon: -3.7038,
      accuracy: 12,
    });
    const { result } = renderHook(() => useUserLocation());

    act(() => result.current.clear());

    expect(useUserLocationStore.getState()).toMatchObject({
      status: "idle",
      location: null,
      error: null,
    });
  });

  it("maps timeout errors to unavailable without treating them as denial", async () => {
    geolocation.getCurrentPosition.mockImplementation((_, reject) => {
      reject({ code: 3, PERMISSION_DENIED: 1, TIMEOUT: 3 });
    });

    const { result } = renderHook(() => useUserLocation());

    await act(async () => {
      await expect(result.current.request()).resolves.toBe("unavailable");
    });

    expect(useUserLocationStore.getState()).toMatchObject({
      status: "unavailable",
      error: "timeout",
    });
  });

  it("ignores a late success callback after the request has failed", async () => {
    let successCallback: ((position: GeolocationPosition) => void) | undefined;
    let errorCallback: ((error: GeolocationPositionError) => void) | undefined;
    geolocation.getCurrentPosition.mockImplementation((success, error) => {
      successCallback = success;
      errorCallback = error;
    });

    const { result } = renderHook(() => useUserLocation());
    let requestPromise: Promise<string> | undefined;

    act(() => {
      requestPromise = result.current.request();
      errorCallback?.({
        code: 1,
        message: "blocked",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
      successCallback?.({
        coords: {
          latitude: 40.4168,
          longitude: -3.7038,
          accuracy: 12,
        } as GeolocationCoordinates,
      } as GeolocationPosition);
    });

    await expect(requestPromise).resolves.toBe("denied");
    expect(useUserLocationStore.getState()).toMatchObject({
      status: "denied",
      location: null,
    });
  });
});
