import { describe, expect, it } from "vitest";
import { readYoutubeMessage } from "./use-youtube-bridge";

const message = (data: unknown) => JSON.stringify(data);

describe("readYoutubeMessage", () => {
  it("ignores non-string and non-JSON payloads", () => {
    expect(readYoutubeMessage({ event: "infoDelivery" })).toBeNull();
    expect(readYoutubeMessage('"event" not json')).toBeNull();
    expect(readYoutubeMessage(message({ other: 1 }))).toBeNull();
  });

  it("reads duration and state from initialDelivery", () => {
    expect(
      readYoutubeMessage(
        message({
          event: "initialDelivery",
          info: { duration: 3200.7, playerState: 3 },
        }),
      ),
    ).toEqual({ event: "initialDelivery", duration: 3200.7, state: 3 });
  });

  it("reads time and mute from infoDelivery", () => {
    expect(
      readYoutubeMessage(
        message({
          event: "infoDelivery",
          info: { currentTime: 12.5, muted: false },
        }),
      ),
    ).toEqual({ event: "infoDelivery", currentTime: 12.5, muted: false });
  });

  it("drops a zero duration so a known one is never overwritten", () => {
    expect(
      readYoutubeMessage(
        message({ event: "infoDelivery", info: { duration: 0 } }),
      ),
    ).toEqual({ event: "infoDelivery" });
  });

  it("reads a numeric state from onStateChange", () => {
    expect(
      readYoutubeMessage(message({ event: "onStateChange", info: 0 })),
    ).toEqual({ event: "onStateChange", state: 0 });
  });

  it("does not read a bare number from other events as a state", () => {
    expect(
      readYoutubeMessage(message({ event: "onVideoProgress", info: 0 })),
    ).toEqual({ event: "onVideoProgress" });
  });

  it("reads the code from onError", () => {
    expect(
      readYoutubeMessage(message({ event: "onError", info: 150 })),
    ).toEqual({ event: "onError", errorCode: 150 });
  });
});
