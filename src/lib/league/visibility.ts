/**
 * Who sees what inside a contest before and after results are published.
 * Owner rule: until publishing, members see panel totals only — each
 * judge's scores and per-criterion breakdowns stay hidden. Pure (tested).
 */
import { LeagueDomainError } from "./definitions";
import type { EventRole } from "@/types/league";

export interface ScoreViewer {
  role: EventRole | null;
  userId: string;
  asCurator: boolean;
  resultsPublished: boolean;
}

/** Filters per-judge score rows for a viewer. */
export function visibleJudgeScores<T extends { judgeUserId: string }>(
  viewer: ScoreViewer,
  scores: readonly T[],
): T[] {
  const organizer = viewer.role === "main_organizer" || viewer.role === "organizer";
  if (viewer.asCurator || organizer || viewer.resultsPublished) return [...scores];
  if (viewer.role === "judge") return scores.filter((score) => score.judgeUserId === viewer.userId);
  return [];
}

/** Riders see only their own video links; staff see every link. */
export function canSeeRunVideo(viewer: ScoreViewer, riderUserId: string): boolean {
  return viewer.asCurator || viewer.role !== "rider" || riderUserId === viewer.userId;
}

export interface VideoSubmissionCheck {
  submissionMode: "live" | "video";
  eventStatus: string;
  deadline: Date | null;
  now: Date;
  runUserId: string;
  userId: string;
  runStatus: string;
}

/** Throws unless this rider may submit or replace this run's video now. */
export function assertVideoSubmissionOpen(check: VideoSubmissionCheck): void {
  if (check.submissionMode !== "video") {
    throw new LeagueDomainError("INVALID_INPUT", "This contest is judged live, not by video");
  }
  if (check.eventStatus !== "live") {
    throw new LeagueDomainError("INVALID_TRANSITION", "Videos can be submitted once the contest starts");
  }
  if (!check.deadline || check.deadline.getTime() <= check.now.getTime()) {
    throw new LeagueDomainError("RUN_WINDOW_CLOSED", "The video deadline has passed");
  }
  if (check.runUserId !== check.userId) {
    throw new LeagueDomainError("NOT_AUTHORIZED", "You can only submit your own runs");
  }
  if (check.runStatus !== "scheduled" && check.runStatus !== "submitted") {
    throw new LeagueDomainError(
      "INVALID_TRANSITION",
      "This run is already judged, so its video is locked",
    );
  }
}
