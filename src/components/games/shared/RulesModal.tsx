"use client";

import {
  DEFAULT_LOCATION_RADIUS_METERS,
  GAME_DEFINITIONS,
  LEVEL_POINTS,
  WINNER_BONUS_POINTS,
} from "@/lib/games/definitions";
import { LetterTrack } from "@/components/games/shared/LetterTrack";
import { GameInfoDialog } from "@/components/games/shared/GameInfoDialog";
import {
  BODY,
  CARD_NESTED,
  CARD_TITLE,
  LABEL,
  TILE,
  controlClass,
  tagClass,
} from "@/components/ui/recipes";

const ALL_WORDS = Object.values(GAME_DEFINITIONS).map((d) => d.eliminationWord);
const POINT_VALUES = Object.values(LEVEL_POINTS);
const MIN_POINTS = Math.min(...POINT_VALUES);
const MAX_POINTS = Math.max(...POINT_VALUES);

function wordList(words: readonly string[]): string {
  if (words.length < 2) return words.join("");
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

export function RulesModal({
  isOpen,
  onClose,
  eliminationWord = null,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The rider's word (BLADE, SKATE, BIKE, SCOOT). Null shows all four. */
  eliminationWord?: string | null;
}) {
  const word = eliminationWord ?? "the word";
  const steps = [
    {
      title: "Set the line",
      copy: "The leader picks a spot type and a level from 1 to 5, and OpenSpot draws a trick from your sport's list. Flexible lets the leader swap the trick mid-round. Strict locks it until the round ends.",
    },
    {
      title: "Set the trick",
      copy: "The leader goes first. Miss it and the lead passes to the other rider, with no letter.",
    },
    {
      title: "Match it",
      copy: `Land it and the other rider has to match it. Miss the match and you take the next letter of ${word}. The leader keeps the lead as long as they keep landing.`,
    },
    {
      title: "Last one standing",
      copy: `Spell ${word} and you're out. The last rider still riding wins.`,
    },
  ];

  return (
    <GameInfoDialog
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="How it works"
      title={eliminationWord ? `Game of ${eliminationWord}` : "The game"}
      closeLabel="Close game rules"
      width="lg"
      footer={
        <button type="button" onClick={onClose} className={controlClass("primary")}>
          Got it
        </button>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className={`${BODY} max-w-md`}>
          Two riders, one word. Miss a trick you have to match and you take a
          letter.{" "}
          {eliminationWord
            ? `Spell ${eliminationWord} and you're out.`
            : `Your sport sets the word: ${wordList(ALL_WORDS)}.`}
        </p>
        {eliminationWord ? (
          <LetterTrack
            word={eliminationWord}
            letters={eliminationWord.slice(0, 2)}
            label={`Example: 2 of ${eliminationWord.length} letters`}
            className="w-full shrink-0 sm:w-44"
          />
        ) : null}
      </div>

      <ol className="mt-5 grid gap-2 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className={CARD_NESTED}>
            <span className={tagClass("outline")}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className={`mt-3 ${CARD_TITLE}`}>{step.title}</h3>
            <p className={`mt-1.5 ${BODY}`}>{step.copy}</p>
          </li>
        ))}
      </ol>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <section className={TILE} aria-labelledby="rules-training-title">
          <p id="rules-training-title" className={LABEL}>
            Training
          </p>
          <p className={`mt-1.5 ${BODY}`}>
            Ride anywhere, alone or with a friend. Games are saved to your
            history and earn no points.
          </p>
        </section>
        <section className={TILE} aria-labelledby="rules-battle-title">
          <p id="rules-battle-title" className={LABEL}>
            Battle
          </p>
          <p className={`mt-1.5 ${BODY}`}>
            Both riders check in within {DEFAULT_LOCATION_RADIUS_METERS} m of a
            registered spot before every round. Landed tricks score{" "}
            {MIN_POINTS}–{MAX_POINTS} points by level, plus{" "}
            {WINNER_BONUS_POINTS} for the win.
          </p>
        </section>
      </div>
    </GameInfoDialog>
  );
}
