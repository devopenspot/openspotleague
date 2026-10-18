import { beforeEach, describe, expect, it } from "vitest";
import { useMapStore } from "./map-store";

describe("map popup selection", () => {
  beforeEach(() => {
    useMapStore.getState().clearActivePins();
  });

  it("clears an active event when selecting a spot", () => {
    useMapStore.getState().setActiveEvent("event-1");
    useMapStore.getState().setActivePin("spot-1");

    expect(useMapStore.getState().activePinId).toBe("spot-1");
    expect(useMapStore.getState().activeEventId).toBeNull();
  });

  it("clears an active spot when selecting an event", () => {
    useMapStore.getState().setActivePin("spot-1");
    useMapStore.getState().setActiveEvent("event-1");

    expect(useMapStore.getState().activeEventId).toBe("event-1");
    expect(useMapStore.getState().activePinId).toBeNull();
  });
});
