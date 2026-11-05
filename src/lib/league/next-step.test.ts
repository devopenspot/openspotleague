import { describe, expect, it } from "vitest";
import { hubTabsFor, nextStepFor, parseHubTab, relativeDue, type NextStepInput } from "./next-step";

const NOW = new Date("2026-11-05T12:00:00.000Z");

function input(partial: Partial<NextStepInput>): NextStepInput {
  return {
    role: "main_organizer",
    status: "draft",
    submissionMode: "live",
    now: NOW,
    startAt: "2026-11-10T15:00:00.000Z",
    submissionDeadlineAt: null,
    resultsPublished: false,
    writesBlocked: false,
    riders: { joined: 0, cap: 3 },
    runs: { total: 0, scoredOrSkipped: 0, awaitingScore: 0 },
    myRuns: [],
    myPendingScores: 0,
    openRun: null,
    hasEntries: false,
    ...partial,
  };
}

describe("relativeDue", () => {
  it("formats days, hours and now", () => {
    expect(relativeDue("2026-11-07T12:00:00.000Z", NOW)).toBe("in 2 days");
    expect(relativeDue("2026-11-05T17:00:00.000Z", NOW)).toBe("in 5 hours");
    expect(relativeDue("2026-11-05T12:30:00.000Z", NOW)).toBe("in under an hour");
    expect(relativeDue("2026-11-01T12:00:00.000Z", NOW)).toBe("now");
  });
});

describe("nextStepFor — organizer", () => {
  it("walks the lifecycle", () => {
    expect(nextStepFor(input({ status: "draft" })).id).toBe("org-open-registration");
    expect(nextStepFor(input({ status: "registration_open" })).id).toBe("org-invite");
    const joined = nextStepFor(input({ status: "registration_open", riders: { joined: 1, cap: 3 } }));
    expect(joined.title).toBe("1 of 3 riders joined");
    expect(nextStepFor(input({ status: "registration_closed", submissionMode: "video" })).action?.label).toBe("Prepare runs");
    expect(nextStepFor(input({ status: "scheduled" })).id).toBe("org-start");
    expect(
      nextStepFor(input({ status: "live", runs: { total: 3, scoredOrSkipped: 1, awaitingScore: 0 } })).id,
    ).toBe("org-open-window");
    expect(
      nextStepFor(input({ status: "live", runs: { total: 3, scoredOrSkipped: 3, awaitingScore: 0 } })).id,
    ).toBe("org-complete");
    expect(nextStepFor(input({ status: "completed" })).id).toBe("org-publish");
    expect(nextStepFor(input({ status: "completed", resultsPublished: true })).tone).toBe("done");
  });

  it("asks a scoring organizer to judge in video mode", () => {
    const step = nextStepFor(
      input({ status: "live", submissionMode: "video", myPendingScores: 2, runs: { total: 4, scoredOrSkipped: 0, awaitingScore: 2 } }),
    );
    expect(step.title).toBe("2 runs waiting for your score");
    expect(step.action?.tab).toBe("judging");
  });

  it("puts payment first when writes are blocked", () => {
    expect(nextStepFor(input({ writesBlocked: true })).tone).toBe("blocked");
  });
});

describe("nextStepFor — judge", () => {
  it("points to the queue while live", () => {
    expect(nextStepFor(input({ role: "judge", status: "live", myPendingScores: 1 })).title).toBe("1 run waiting for your score");
    expect(nextStepFor(input({ role: "judge", status: "live" })).tone).toBe("waiting");
    expect(nextStepFor(input({ role: "judge", status: "scheduled" })).action?.tab).toBe("overview");
  });
});

describe("nextStepFor — rider", () => {
  const videoRun = { runId: "r1", divisionLabel: "Roller · Park", status: "scheduled", hasVideo: false, scheduledAt: null, windowEndsAt: null };

  it("asks for divisions first", () => {
    expect(nextStepFor(input({ role: "rider", status: "registration_open" })).id).toBe("rider-enter");
  });

  it("asks for the missing video with its deadline", () => {
    const step = nextStepFor(
      input({
        role: "rider",
        status: "live",
        submissionMode: "video",
        hasEntries: true,
        submissionDeadlineAt: "2026-11-07T12:00:00.000Z",
        myRuns: [videoRun],
      }),
    );
    expect(step.title).toBe("Submit your Roller · Park video");
    expect(step.body).toContain("in 2 days");
  });

  it("says you're up when your live window is open", () => {
    const step = nextStepFor(
      input({ role: "rider", status: "live", hasEntries: true, openRun: { runId: "r1", isMine: true } }),
    );
    expect(step.id).toBe("rider-up-now");
  });

  it("offers the result card once published", () => {
    expect(nextStepFor(input({ role: "rider", status: "completed", hasEntries: true, resultsPublished: true })).id).toBe("rider-share");
  });
});

describe("hub tabs", () => {
  it("are role-aware and fall back to overview", () => {
    expect(hubTabsFor("rider")).toEqual(["overview", "standings", "my-runs"]);
    expect(hubTabsFor("judge")).toContain("judging");
    expect(hubTabsFor(null)).toEqual(["overview", "standings"]);
    expect(parseHubTab("run", "rider")).toBe("overview");
    expect(parseHubTab("run", "organizer")).toBe("run");
  });
});
