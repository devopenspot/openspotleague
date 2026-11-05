import { describe, expect, it } from "vitest";
import { LeagueDomainError } from "./definitions";
import { assertVideoSubmissionOpen, canSeeRunVideo, visibleJudgeScores, type ScoreViewer } from "./visibility";

const scores = [
  { judgeUserId: "j1", total: 80 },
  { judgeUserId: "j2", total: 70 },
];

function viewer(partial: Partial<ScoreViewer>): ScoreViewer {
  return { role: "rider", userId: "r1", asCurator: false, resultsPublished: false, ...partial };
}

describe("visibleJudgeScores", () => {
  it("hides every judge's scores from riders before publishing", () => {
    expect(visibleJudgeScores(viewer({ role: "rider" }), scores)).toEqual([]);
  });
  it("shows a judge only their own scores before publishing", () => {
    expect(visibleJudgeScores(viewer({ role: "judge", userId: "j2" }), scores)).toEqual([scores[1]]);
  });
  it("shows organizers and curators everything", () => {
    expect(visibleJudgeScores(viewer({ role: "organizer" }), scores)).toHaveLength(2);
    expect(visibleJudgeScores(viewer({ role: null, asCurator: true }), scores)).toHaveLength(2);
  });
  it("shows the full breakdown to members once published", () => {
    expect(visibleJudgeScores(viewer({ role: "rider", resultsPublished: true }), scores)).toHaveLength(2);
  });
});

describe("canSeeRunVideo", () => {
  it("lets riders see only their own videos", () => {
    expect(canSeeRunVideo(viewer({}), "r1")).toBe(true);
    expect(canSeeRunVideo(viewer({}), "r2")).toBe(false);
    expect(canSeeRunVideo(viewer({ role: "judge" }), "r2")).toBe(true);
  });
});

describe("assertVideoSubmissionOpen", () => {
  const base = {
    submissionMode: "video" as const,
    eventStatus: "live",
    deadline: new Date("2026-11-10T00:00:00Z"),
    now: new Date("2026-11-05T00:00:00Z"),
    runUserId: "r1",
    userId: "r1",
    runStatus: "scheduled",
  };
  const codeOf = (fn: () => void) => {
    try {
      fn();
      return null;
    } catch (error) {
      return error instanceof LeagueDomainError ? error.code : "other";
    }
  };
  it("accepts the owner before the deadline", () => {
    expect(codeOf(() => assertVideoSubmissionOpen(base))).toBeNull();
    expect(codeOf(() => assertVideoSubmissionOpen({ ...base, runStatus: "submitted" }))).toBeNull();
  });
  it("rejects after the deadline", () => {
    expect(codeOf(() => assertVideoSubmissionOpen({ ...base, now: new Date("2026-11-11T00:00:00Z") }))).toBe("RUN_WINDOW_CLOSED");
  });
  it("rejects other riders", () => {
    expect(codeOf(() => assertVideoSubmissionOpen({ ...base, userId: "r2" }))).toBe("NOT_AUTHORIZED");
  });
  it("rejects judged runs, live contests and contests not started", () => {
    expect(codeOf(() => assertVideoSubmissionOpen({ ...base, runStatus: "scored" }))).toBe("INVALID_TRANSITION");
    expect(codeOf(() => assertVideoSubmissionOpen({ ...base, submissionMode: "live" }))).toBe("INVALID_INPUT");
    expect(codeOf(() => assertVideoSubmissionOpen({ ...base, eventStatus: "scheduled" }))).toBe("INVALID_TRANSITION");
  });
});
