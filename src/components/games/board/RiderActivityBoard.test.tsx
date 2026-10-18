import { describe, expect, it } from "vitest";
import { activityTone } from "@/components/games/board/RiderActivityBoard";

describe("activityTone", () => {
  it("uses the green scale from empty through peak activity", () => {
    expect(activityTone(0, 10)).toBe("bg-activity-empty");
    expect(activityTone(2, 10)).toBe("bg-activity-low");
    expect(activityTone(5, 10)).toBe("bg-activity-medium");
    expect(activityTone(8, 10)).toBe("bg-activity-high");
    expect(activityTone(9, 10)).toBe("bg-activity-peak");
  });
});
