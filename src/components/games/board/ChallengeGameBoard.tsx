"use client";

import { useState } from "react";
import { Check, CircleDot, CircleHelp, LockKeyhole, RotateCcw, X } from "lucide-react";
import { Overlay } from "@/components/feedback/Overlay";
import type { GameState } from "@/lib/schemas/game";
import type {
  ChallengeBoardStage,
  StageResult,
} from "@/lib/games/challenge-board-model";
import {
  buildChallengeBoardStages,
  stagePoints,
  stageRoundResult,
} from "@/lib/games/challenge-board-model";
import { ChallengeRiderTracksContent } from "@/components/games/board/ChallengeRiderTracks";
import { ChallengeRiderTracksSheet } from "@/components/games/board/ChallengeRiderTracksSheet";

type InlineResultAction = {
  label: string;
  onSelect: (result: "landed" | "failed") => void;
};

export function ChallengeGameBoard({
  game,
  variant = "default",
  resultAction = null,
  canAdvanceToNextTrick = false,
  alternativeTricksRemaining = 0,
  onNextTrick,
  busy = false,
}: {
  game: GameState;
  variant?: "default" | "panel";
  resultAction?: InlineResultAction | null;
  canAdvanceToNextTrick?: boolean;
  alternativeTricksRemaining?: number;
  onNextTrick?: () => void;
  busy?: boolean;
}) {
  const stages = buildChallengeBoardStages(game);
  const currentStageId = game.currentRound?.id ?? null;
  const stageListLabel =
    game.trainingVariant === "solo" ? "Your Run" : "Session Stages";
  const showRiderTracks = game.trainingVariant !== "solo";
  const isPanel = variant === "panel";

  return (
    <>
      <section
        aria-labelledby="challenge-route-title"
        className={
          isPanel
            ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-container-lowest"
            : "overflow-hidden rounded-[16px] border border-outline-variant bg-surface-container-lowest"
        }
      >
        <h2 id="challenge-route-title" className="sr-only">
          {game.currentRound ? "Current Trick" : stageListLabel}
        </h2>
        <div
          className={
            showRiderTracks
              ? isPanel
                ? "grid min-h-0 flex-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_18rem]"
                : "grid md:grid-cols-[minmax(0,1fr)_18rem]"
              : isPanel
                ? "grid min-h-0 flex-1 overflow-hidden"
                : "grid"
          }
        >
          <div
            className={
              isPanel
                ? "flex min-h-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2"
                : "min-w-0 p-4"
            }
          >
            <ol
              aria-label={stageListLabel}
              className={
                isPanel
                  ? "flex min-h-0 flex-1 flex-col divide-y divide-outline-variant overflow-y-auto overscroll-contain rounded-[12px] border border-outline-variant bg-surface-container-lowest"
                  : "divide-y divide-outline-variant border-y border-outline-variant"
              }
            >
              {stages.length === 0 ? (
                <EmptyStageRow />
              ) : (
                stages
                  .reverse()
                  .map((view) => (
                    <ChallengeStageRow
                      key={view.stage.id}
                      view={view}
                      game={game}
                      currentStageId={currentStageId}
                      resultAction={resultAction}
                      canAdvanceToNextTrick={canAdvanceToNextTrick}
                      alternativeTricksRemaining={alternativeTricksRemaining}
                      onNextTrick={onNextTrick}
                      busy={busy}
                    />
                  ))
              )}
            </ol>
          </div>

          {showRiderTracks ? (
            <aside
              aria-labelledby="challenge-rider-tracks-title"
              className={
                isPanel
                  ? "hidden min-h-0 flex-col overflow-y-auto overscroll-contain border-t border-outline-variant bg-surface-container-low p-2.5 sm:p-3 md:flex md:border-l md:border-t-0"
                  : "hidden border-t border-outline-variant bg-surface-container-low p-4 md:block md:border-l md:border-t-0"
              }
            >
              <ChallengeRiderTracksContent
                game={game}
                headingId="challenge-rider-tracks-title"
              />
            </aside>
          ) : null}
        </div>
      </section>
      {showRiderTracks ? <ChallengeRiderTracksSheet game={game} /> : null}
    </>
  );
}

function EmptyStageRow() {
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 bg-surface-container-low px-3 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:px-4 sm:py-4">
      <StageNode state="future" />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-secondary">
            Get Ready
          </p>
          <h3 className="min-w-0 flex-1 font-display text-[17px] font-bold leading-[1.3] text-on-surface sm:text-xl">
            Your First Trick Drops When You Start
          </h3>
        </div>
        <p className="mt-1.5 text-[13px] leading-5 text-on-surface-variant">
          Invite your crew and drop in — your line starts here.
        </p>
      </div>
    </li>
  );
}

function ChallengeStageRow({
  view,
  game,
  currentStageId,
  resultAction,
  canAdvanceToNextTrick,
  alternativeTricksRemaining,
  onNextTrick,
  busy,
}: {
  view: ChallengeBoardStage;
  game: GameState;
  currentStageId: string | null;
  resultAction: InlineResultAction | null;
  canAdvanceToNextTrick: boolean;
  alternativeTricksRemaining: number;
  onNextTrick?: () => void;
  busy: boolean;
}) {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const stage = view.stage;
  const isCurrent =
    stage.id === currentStageId && view.visualState === "current";
  const result =
    !isCurrent && view.visualState === "complete"
      ? stageRoundResult(stage)
      : null;
  const currentDescription =
    isCurrent && game.currentRound?.id === stage.id
      ? game.currentRound.trickDescription
      : null;
  const score = stagePoints(stage, game.viewerPlayerId);
  const stageTitle = stage.trickName ?? "Setting Up Your Line";
  const instructionsTitleId = `challenge-stage-${stage.id}-instructions-title`;
  const instructionsDescriptionId = `challenge-stage-${stage.id}-instructions-description`;
  const instructionsContentId = `challenge-stage-${stage.id}-instructions-content`;
  const instructionsTitle = `How To Do ${stageTitle}`;

  return (
    <li
      aria-current={isCurrent ? "step" : undefined}
      className={`grid items-start gap-3 px-3 py-4 sm:px-4 sm:py-4 ${isCurrent ? "bg-primary-container/25 ring-1 ring-primary/15" : view.visualState === "complete" ? "bg-surface-container-low/50" : "bg-surface-container-lowest"} grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_minmax(0,1fr)]`}
    >
      <StageNode
        state={
          isCurrent
            ? "current"
            : view.visualState === "complete"
              ? "complete"
              : "future"
        }
        result={result}
      />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="inline-flex items-center rounded-full bg-surface-container-high px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-secondary">
              Round {stage.sequence}
            </p>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-secondary">
              <span
                className={`h-1.5 w-1.5 rounded-full ${view.visualState === "complete" ? "bg-on-surface" : isCurrent ? "bg-primary animate-pulse-dot" : "bg-outline-variant"}`}
                aria-hidden
              />
            </span>
            {game.mode === "challenge" && score > 0 ? (
              <span className="inline-flex items-center rounded-full bg-on-surface px-2 py-0.5 font-display text-[11px] font-bold text-surface">
                +{score} pts
              </span>
            ) : null}
          </div>
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h3
              title={stageTitle}
              className={`font-display text-[17px] font-bold leading-[1.25] sm:text-xl sm:leading-[1.3] ${isCurrent ? "text-primary" : "text-on-surface"}`}
            >
              {stageTitle}
            </h3>
            {currentDescription ? (
              <button
                type="button"
                onClick={() => setInstructionsOpen(true)}
                aria-label={instructionsTitle}
                aria-expanded={instructionsOpen}
                aria-controls={instructionsContentId}
                aria-haspopup="dialog"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-secondary transition-[background-color,border-color,color,transform] hover:border-outline hover:bg-surface-container hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
              >
                <CircleHelp size={18} aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {result ? (
            <p className="sr-only">
              {result === "landed" ? "Landed" : "Missed"}
            </p>
          ) : null}
        </div>

        {isCurrent && resultAction ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-2"
            aria-label={resultAction.label}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => resultAction.onSelect("landed")}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-primary shadow-[0_1px_0_rgba(0,0,0,0.1)] hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
            >
              <Check size={15} aria-hidden="true" />
              Landed
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => resultAction.onSelect("failed")}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50"
            >
              <X size={15} aria-hidden="true" />
              Failed
            </button>
            {canAdvanceToNextTrick && onNextTrick ? (
              <button
                type="button"
                onClick={onNextTrick}
                disabled={busy || alternativeTricksRemaining === 0}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3.5 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw size={13} aria-hidden="true" />
                {alternativeTricksRemaining > 0
                  ? `Next · ${alternativeTricksRemaining}`
                  : "No more"}
              </button>
            ) : null}
          </div>
        ) : null}

        {isCurrent && stage.attempts.length > 0 ? (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            aria-label={`Stage ${stage.sequence} rider results`}
          >
            <span className="mr-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              {game.trainingVariant === "solo" ? "Result" : "Responses"}
            </span>
            {stage.attempts.map((attempt) => {
              const player = game.players.find(
                (candidate) => candidate.id === attempt.playerId,
              );
              return (
                <span
                  key={attempt.playerId}
                  className={`rounded-[8px] border px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em] ${attempt.result === "landed" ? "border-on-surface bg-on-surface text-surface" : "border-outline-variant bg-surface-container-high text-on-surface-variant"}`}
                >
                  {player?.displayName ?? "Rider"} / {attempt.result}
                </span>
              );
            })}
          </div>
        ) : null}

        {isCurrent && game.mode === "challenge" && stage.scores.length > 0 ? (
          <div
            className="mt-2 flex flex-wrap items-center gap-1.5"
            aria-label={`Stage ${stage.sequence} points posted`}
          >
            <span className="mr-1 font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
              Points
            </span>
            {stage.scores.map((stageScore) => {
              const player = game.players.find(
                (candidate) => candidate.id === stageScore.playerId,
              );
              return (
                <span
                  key={stageScore.playerId}
                  className="rounded-[8px] border border-on-surface bg-surface-container-high px-2 py-1 font-display text-xs font-semibold uppercase tracking-[0.05em]"
                >
                  {player?.displayName ?? "Rider"} / +{stageScore.points} pts
                </span>
              );
            })}
          </div>
        ) : null}

        {currentDescription ? (
          <Overlay
            isOpen={instructionsOpen}
            onClose={() => setInstructionsOpen(false)}
            labelledBy={instructionsTitleId}
            describedBy={instructionsDescriptionId}
            contentId={instructionsContentId}
            panelClassName="mx-5 w-[min(32rem,calc(100vw-2.5rem))] rounded-[16px] border border-outline-variant bg-surface-container-lowest p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary">
                  Round {stage.sequence} · How To Land It
                </p>
                <h4
                  id={instructionsTitleId}
                  className="mt-2 font-display text-2xl font-bold leading-[1.15] text-on-surface"
                >
                  {instructionsTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setInstructionsOpen(false)}
                aria-label="Close trick instructions"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-high text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <p
              id={instructionsDescriptionId}
              className="mt-4 text-sm leading-6 text-on-surface-variant"
            >
              {currentDescription}
            </p>
          </Overlay>
        ) : null}
      </div>
    </li>
  );
}

function StageNode({
  state,
  result = null,
}: {
  state: "complete" | "current" | "future";
  result?: StageResult;
}) {
  const toneClass =
    result === "landed"
      ? "border-permission-granted bg-permission-granted text-white"
      : result === "failed"
        ? "border-error bg-error text-on-error"
        : state === "complete"
          ? "border-on-surface bg-on-surface text-surface shadow-[0_1px_0_rgba(0,0,0,0.12)]"
          : state === "current"
            ? "border-primary bg-surface-container-lowest text-primary shadow-[0_1px_0_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]"
            : "border-outline-variant bg-surface-container-high text-secondary";
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border-2 sm:h-10 sm:w-10 sm:rounded-[10px] ${toneClass}`}
      aria-hidden="true"
    >
      {result === "failed" ? (
        <X size={16} strokeWidth={3} />
      ) : state === "complete" ? (
        <Check size={16} strokeWidth={3} />
      ) : null}
      {state === "current" ? <CircleDot size={18} strokeWidth={2.5} /> : null}
      {state === "future" ? <LockKeyhole size={15} /> : null}
    </div>
  );
}
