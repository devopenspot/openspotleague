"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams as useNextSearchParams } from "next/navigation";
import { JoinWithCode } from "@/components/shell/JoinWithCode";
import { parseGamePrefill } from "@/lib/games/prefill";
import { RulesModal } from "@/components/games/shared/RulesModal";
import { MatchesDrawer } from "@/components/games/matches/MatchesDrawer";
import { GAME_DEFINITIONS, type GameDefinition } from "@/lib/games/definitions";
import { resolveGameDiscipline } from "@/lib/games/discipline";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUIStore } from "@/stores/ui-store";
import { GameCreateForm } from "@/components/games/GameCreateForm";
import { ResponsibilityPolicyModal } from "@/components/games/shared/ResponsibilityPolicyModal";
import { CARD, EYEBROW, META, tagClass } from "@/components/ui/recipes";
import { dottedWord } from "@/lib/games/game-title";
import { ResumeGameCard } from "@/components/games/matches/ResumeGameCard";
import {
  useMyGames,
  useResumableGame,
} from "@/components/games/hooks/useMyGames";
import {
  RiderActivityBoard,
  useRiderActivity,
  type RiderActivityData,
} from "@/components/games/board/RiderActivityBoard";

type Ranking = {
  totalPoints: number;
  rank: string;
  gamesPlayed: number;
  gamesWon: number;
  tricksLanded: number;
};

// User-visible strings for the landing page.
const UI_COPY = {
  yourGames: `Your games`,
  yourRecord: `Your record`,
  setupTitle: `Set up your game`,
  modeHint: `Training works anywhere and is saved to your history. Battles are verified at a registered spot and earn leaderboard points.`,
  challengeRecord: `Battle rank · leaderboard points`,
  gameNotFound: `That code didn't match a game. Check it with your friend and try again.`,
  gameUnavailable: `That game has ended or is full. Ask your friend for a new code.`,
  loading: `Loading`,
  unavailable: `Unavailable`,
  newRider: `New Rider`,
  played: `Played`,
  won: `Won`,
  landed: `Tricks landed`,
  setPreference: `Set preference`,
  gameRules: `Game rules`,
  riderPolicy: `Rider policy`,
  disciplineWordDescription: {
    prefix: `You play a game of`,
    suffix: `.`,
    fallback: `Pick Roller, Skateboard, BMX or Scooter — your elimination word appears here.`,
  },
} as const;

const RANKING_PATH = "/api/ranking/me";

const UI_TEMPLATES = {
  eliminationWordAria: (word: string) => `Elimination word ${word}`,
  points: (totalPoints: number) => `${totalPoints} points`,
};

export function GameLanding({ signedIn }: { signedIn: boolean }) {
  return (
    <Suspense fallback={null}>
      <GameLandingContent signedIn={signedIn} />
    </Suspense>
  );
}

function GameLandingContent({ signedIn }: { signedIn: boolean }) {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [rankingError, setRankingError] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const searchParams = useNextSearchParams();
  const joinError = searchParams.get("error");
  const joinFailedMessage =
    joinError === "game-not-found"
      ? UI_COPY.gameNotFound
      : joinError === "game-unavailable"
        ? UI_COPY.gameUnavailable
        : null;
  const prefill = useMemo(() => parseGamePrefill(searchParams), [searchParams]);
  const preferredSport = usePreferencesStore((s) => s.preferredSport);
  const preferencesHydrationStatus = usePreferencesStore(
    (s) => s.hydrationStatus,
  );
  const openPreferences = useUIStore((s) => s.openPreferences);
  const discipline = resolveGameDiscipline(preferredSport);
  const riderActivity = useRiderActivity(signedIn);
  const myGames = useMyGames({ limit: 5, enabled: signedIn });
  const resumableGame = useResumableGame({ signedIn, games: myGames.games });

  const definition: GameDefinition | null = discipline
    ? GAME_DEFINITIONS[discipline]
    : null;
  const eliminationWord = definition?.eliminationWord ?? null;
  const isAllDisciplines = preferredSport === "all";

  useEffect(() => {
    if (
      [`ready`, `error`].includes(preferencesHydrationStatus) &&
      preferredSport === null
    ) {
      openPreferences();
    }
  }, [openPreferences, preferencesHydrationStatus, preferredSport]);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    void fetch(RANKING_PATH, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("ranking request failed");
        return response.json() as Promise<Ranking>;
      })
      .then((value) => setRanking(value))
      .catch(() => {
        if (!controller.signal.aborted) setRankingError(true);
      });
    return () => controller.abort();
  }, [signedIn]);

  return (
    <>
      <div className="flex flex-1 flex-col bg-gradient-primary px-5 py-4 sm:px-6 sm:py-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col mb-20 md:mb-0">
          <div className={`flex justify-center gap-2 py-2`}>
            {/* One instance: pinned above the start buttons on phones. */}
            <div className="fixed inset-x-3 bottom-[calc(var(--mobile-nav-h)+6rem)] z-50 md:bottom-[calc(6rem+env(safe-area-inset-bottom))] lg:static">
              <JoinWithCode variant="games" className="w-full lg:w-auto" />
            </div>
            {signedIn ? (
              <button
                type="button"
                onClick={() => setGamesOpen(true)}
                aria-expanded={gamesOpen}
                aria-controls="matches-drawer"
                className="inline-flex min-h-12 items-center rounded-lg border-2 border-on-surface bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-[background-color,transform] hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px"
              >
                {UI_COPY.yourGames}
              </button>
            ) : null}
          </div>
          {joinFailedMessage ? (
            <p
              role="alert"
              className="mt-2 rounded-lg border-2 border-error bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container"
            >
              {joinFailedMessage}
            </p>
          ) : null}
          {resumableGame ? (
            <div className="mt-2">
              <ResumeGameCard game={resumableGame} />
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-center gap-3 rounded-lg bg-surface-container-lowest px-4 py-2.5 text-on-surface">
            <p className="text-sm font-semibold leading-5">
              {discipline && eliminationWord ? (
                <>{`${UI_COPY.disciplineWordDescription.prefix} `}</>
              ) : isAllDisciplines ? (
                <>
                  All disciplines selected. Choose a sport below to start a
                  training or battle game.
                </>
              ) : (
                <>{`${UI_COPY.disciplineWordDescription.fallback}`}</>
              )}
            </p>
            {discipline && eliminationWord ? (
              <span
                aria-label={UI_TEMPLATES.eliminationWordAria(eliminationWord)}
                className="shrink-0 font-display text-base font-bold uppercase tracking-[0.18em]"
              >
                {dottedWord(eliminationWord)}
              </span>
            ) : (
              <button
                type="button"
                onClick={openPreferences}
                className="inline-flex min-h-12 shrink-0 items-center rounded-lg border-2 border-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
              >
                {isAllDisciplines ? "Preferences" : UI_COPY.setPreference}
              </button>
            )}
          </div>
          <section aria-labelledby={`create-game-title`}>
            <div className={``}>
              <h2
                id={`create-game-title`}
                className={`mt-4 font-display text-on-primary text-2xl font-bold uppercase leading-[1.3] tracking-[-0.02em]`}
              >
                {UI_COPY.setupTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-on-primary/80">
                {UI_COPY.modeHint}
              </p>
              <GameCreateForm signedIn={signedIn} initialPrefill={prefill} />
            </div>
          </section>
          <LandingInfo
            onOpenRules={() => setRulesOpen(true)}
            onOpenPolicy={() => setPolicyOpen(true)}
          />
        </div>
      </div>
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ResponsibilityPolicyModal
        isOpen={policyOpen}
        onClose={() => setPolicyOpen(false)}
      />
      {signedIn ? (
        <MatchesDrawer
          isOpen={gamesOpen}
          onClose={() => setGamesOpen(false)}
          authenticated={signedIn}
        >
          <div className="space-y-4 pt-4 pb-20">
            <RiderProgressContent
              ranking={ranking}
              rankingError={rankingError}
              activity={riderActivity}
              activityHeadingId={`rider-activity-title-mobile`}
            />
          </div>
        </MatchesDrawer>
      ) : null}
    </>
  );
}

function LandingInfo({
  onOpenRules,
  onOpenPolicy,
}: {
  onOpenRules: () => void;
  onOpenPolicy: () => void;
}) {
  return (
    <footer
      role="contentinfo"
      aria-label="Game information and rules"
      className="mx-auto pb-6 text-on-gradient sm:pt-10 sm:pb-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="mb-12 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onOpenRules}
            className="inline-flex min-h-12 items-center rounded-lg bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            {UI_COPY.gameRules}
          </button>
          <button
            type="button"
            onClick={onOpenPolicy}
            className="inline-flex min-h-12 items-center rounded-lg bg-surface-container-lowest px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2"
          >
            {UI_COPY.riderPolicy}
          </button>
        </div>
      </div>
    </footer>
  );
}

function RiderProgressContent({
  ranking,
  rankingError,
  activity,
  activityHeadingId,
}: {
  ranking: Ranking | null;
  rankingError: boolean;
  activity: RiderActivityData;
  activityHeadingId: string;
}) {
  const loading = !ranking && !rankingError;
  return (
    <div className="space-y-3">
      <section
        className={`min-w-0 ${CARD}`}
        aria-labelledby="rider-record-title"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="rider-record-title" className={EYEBROW}>
            {UI_COPY.yourRecord}
          </h2>
          {ranking && !rankingError ? (
            <span className={tagClass("outline")}>
              {UI_TEMPLATES.points(ranking.totalPoints)}
            </span>
          ) : null}
        </div>
        <div className="mt-3">
          {loading ? (
            <div
              role="status"
              aria-label={UI_COPY.loading}
              className="h-9 w-40 rounded-control bg-surface-container-high"
            />
          ) : (
            <p className="font-display text-4xl font-bold uppercase leading-none tracking-display text-on-surface">
              {rankingError
                ? UI_COPY.unavailable
                : (ranking?.rank ?? UI_COPY.newRider)}
            </p>
          )}
          <p className={`mt-2 ${META}`}>{UI_COPY.challengeRecord}</p>
        </div>
      </section>
      <RiderActivityBoard data={activity} headingId={activityHeadingId} />
    </div>
  );
}
