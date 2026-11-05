import { describe, expect, it } from "vitest";
import { buildNextStepInput, myRuns, openLiveRun, runStatusLabel, runsAwaitingMyScore, type HubStateLike } from "./hub-state";

const NOW = new Date("2026-11-05T12:00:00.000Z");

function state(partial: Partial<HubStateLike> = {}): HubStateLike {
  return {
    event: {
      status: "live",
      submissionMode: "video",
      submissionDeadlineAt: "2026-11-07T12:00:00.000Z",
      startAt: "2026-11-04T12:00:00.000Z",
      resultsPublished: false,
    },
    myRole: "judge",
    myUserId: "j1",
    readOnly: false,
    counts: { riders: 2 },
    plan: { maxRiders: 3 },
    divisions: [{ id: "d1", label: "Roller · Park", hasBestTrick: false }],
    myEntry: null,
    runs: [
      { id: "r1", divisionId: "d1", sequence: 1, riderUserId: "u1", status: "submitted", scheduledAt: null, windowEndsAt: null, videoUrl: "https://youtu.be/a", scores: [] },
      { id: "r2", divisionId: "d1", sequence: 2, riderUserId: "u2", status: "scored", scheduledAt: null, windowEndsAt: null, videoUrl: "https://youtu.be/b", scores: [{ judgeUserId: "j1" }] },
      { id: "r3", divisionId: "d1", sequence: 3, riderUserId: "u3", status: "scheduled", scheduledAt: null, windowEndsAt: null, videoUrl: null, scores: [] },
    ],
    ...partial,
  };
}

describe("hub-state", () => {
  it("queues video runs the judge hasn't scored", () => {
    expect(runsAwaitingMyScore(state(), NOW).map((run) => run.id)).toEqual(["r1"]);
  });

  it("queues only the open live window", () => {
    const live = state({
      event: { ...state().event, submissionMode: "live" },
      runs: [
        { id: "a", divisionId: "d1", sequence: 1, riderUserId: "u1", status: "judging", scheduledAt: null, windowEndsAt: "2026-11-05T12:05:00.000Z", videoUrl: null, scores: [] },
        { id: "b", divisionId: "d1", sequence: 2, riderUserId: "u2", status: "judging", scheduledAt: null, windowEndsAt: "2026-11-05T11:00:00.000Z", videoUrl: null, scores: [] },
      ],
    });
    expect(runsAwaitingMyScore(live, NOW).map((run) => run.id)).toEqual(["a"]);
    expect(openLiveRun(live, NOW)?.id).toBe("a");
  });

  it("labels run statuses for people", () => {
    expect(runStatusLabel("scheduled", "video")).toBe("Video missing");
    expect(runStatusLabel("scheduled", "live")).toBe("Waiting");
    expect(runStatusLabel("submitted", "video")).toBe("Video in");
  });

  it("builds the next-step input for a rider", () => {
    const rider = state({ myRole: "rider", myUserId: "u3" });
    expect(myRuns(rider).map((run) => run.id)).toEqual(["r3"]);
    const input = buildNextStepInput(rider, NOW);
    expect(input?.myRuns[0]).toMatchObject({ divisionLabel: "Roller · Park", hasVideo: false });
    expect(input?.hasEntries).toBe(true);
    expect(input?.riders).toEqual({ joined: 2, cap: 3 });
    expect(input?.runs).toEqual({ total: 3, scoredOrSkipped: 1, awaitingScore: 1 });
  });

  it("returns null for curators without a role", () => {
    expect(buildNextStepInput(state({ myRole: null }), NOW)).toBeNull();
  });
});
