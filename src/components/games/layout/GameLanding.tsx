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
import { MatchList } from "@/components/games/matches/MatchList";
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

// Centralized UI copy using template literals — single source for all user-visible strings
const UI_COPY = {
  yourGames: `Your games`,
  yourRecord: `Your record`,
  setupTitle: `Set up your game`,
  challengeRecord: `Challenge record`,
  gameNotFound: `That code didn't match a game. Check it with your friend and try again.`,
  loading: `Loading`,
  unavailable: `Unavailable`,
  newRider: `New Rider`,
  played: `Played`,
  won: `Won`,
  landed: `Landed`,
  setPreference: `Set preference`,
  gameRules: `Game rules`,
  riderPolicy: `Rider policy`,
  disciplineWordDescription: {
    prefix: `You play a game of`,
    suffix: `.`,
    fallback: `Pick Roller, Skateboard, BMX or Scooter — your elimination word appears here.`,
  },
  rankingErrorTitle: `ranking request failed`,
  apiRankingPath: `/api/ranking/me`,
} as const;

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
  const joinFailed = searchParams.get("error") === "game-not-found";
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
    void fetch(UI_COPY.apiRankingPath, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(UI_COPY.rankingErrorTitle);
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
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
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
          {joinFailed ? (
            <p
              role="alert"
              className="mt-2 rounded-lg border-2 border-error bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container"
            >
              {UI_COPY.gameNotFound}
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
                  training or challenge game.
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
                {eliminationWord.split("").join(".")}
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
              <GameCreateForm signedIn={signedIn} initialPrefill={prefill} />
            </div>
          </section>
          {signedIn ? (
            <section
              aria-labelledby="recent-matches-title"
              className="mt-6 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-5 sm:p-6 text-on-surface shadow-[0_8px_24px_rgba(18,18,18,0.06)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant pb-4">
                <div>
                  <p className="font-display text-[10px] font-semibold uppercase tracking-[0.05em] text-secondary">
                    Your matches
                  </p>
                  <h2
                    id="recent-matches-title"
                    className="mt-1 font-display text-2xl font-bold uppercase leading-none"
                  >
                    Active & Recent
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setGamesOpen(true)}
                  className="inline-flex min-h-12 items-center rounded-lg border-2 border-on-surface px-4 font-display text-sm font-bold uppercase tracking-[0.04em] text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                  View all
                </button>
              </div>
              <MatchList bare limit={5} list={myGames} />
            </section>
          ) : null}
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
        <MatchesDrawer isOpen={gamesOpen} onClose={() => setGamesOpen(false)}>
          <div className="space-y-4 py-4">
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
      className="mt-auto mx-auto border-t border-white/20 pt-8 pb-6 text-on-gradient sm:pt-10 sm:pb-8"
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div
      className={`min-w-0 rounded-[8px] border border-outline-variant bg-surface-container px-1.5 py-3 sm:px-2`}
    >
      <dt className={`font-display text-2xl font-bold leading-none`}>
        {value}
      </dt>
      <dd
        className={`mt-2 font-display text-xs uppercase leading-tight tracking-[0.05em] text-secondary`}
      >
        {label}
      </dd>
    </div>
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
  return (
    <>
      <div
        className={`min-w-0 rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5`}
      >
        <div className={`flex items-start justify-between gap-3 sm:gap-4`}>
          <p
            className={`font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary`}
          >
            {UI_COPY.yourRecord}
          </p>
          <span
            className={`shrink-0 font-display text-xs uppercase tracking-widest text-secondary`}
          >
            {UI_COPY.challengeRecord}
          </span>
        </div>

        <div
          className={`mt-4`}
        >
          <p
            className={`font-display text-4xl font-bold uppercase leading-none sm:text-5xl`}
          >
            {!ranking && !rankingError
              ? UI_COPY.loading
              : rankingError
                ? UI_COPY.unavailable
                : (ranking?.rank ?? UI_COPY.newRider)}
          </p>
          <p
            className={`mt-2 font-display text-xs uppercase tracking-[0.05em] text-secondary`}
          >
            {!ranking || rankingError
              ? ``
              : UI_TEMPLATES.points(ranking.totalPoints)}
          </p>
        </div>
        <dl
          className={`${`mt-5 grid grid-cols-3 gap-2 text-center sm:mt-6`} ${!ranking || rankingError ? `opacity-40` : ``}`}
        >
          <Stat value={ranking?.gamesPlayed ?? 0} label={UI_COPY.played} />
          <Stat value={ranking?.gamesWon ?? 0} label={UI_COPY.won} />
          <Stat value={ranking?.tricksLanded ?? 0} label={UI_COPY.landed} />
        </dl>
      </div>
      <div className={`min-w-0 overflow-hidden rounded-[16px] bg-on-surface`}>
        <RiderActivityBoard data={activity} headingId={activityHeadingId} />
      </div>
    </>
  );
}
