"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams as useNextSearchParams } from "next/navigation";
import { X } from "lucide-react";
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
import {
  RiderActivityBoard,
  useRiderActivity,
  type RiderActivityData,
} from "@/components/games/board/RiderActivityBoard";
import { SideDrawer } from "@/components/feedback/SideDrawer";

type Ranking = {
  totalPoints: number;
  rank: string;
  gamesPlayed: number;
  gamesWon: number;
  tricksLanded: number;
};

// Centralized UI copy using template literals — single source for all user-visible strings
const UI_COPY = {
  joinWithCode: `Join with code`,
  yourRecord: `Your record`,
  setupTitle: `Set up your game`,
  joinEyebrow: `Join a game`,
  joinTitle: `Have a share code?`,
  joinDescription: `Enter the code shared by the host to join their live training.`,
  closeJoinGame: `Close join game`,
  closeYourRecord: `Close your record`,
  enterShareCodeLabel: `Enter a game share code`,
  placeholder: `ENTER SHARE CODE`,
  join: `Join`,
  emptyShareCodeError: `Enter a share code to join a game.`,
  shareCodeErrorId: `share-code-error`,
  challengeRecord: `Challenge record`,
  viewMatches: `View your matches`,
  loading: `Loading`,
  unavailable: `Unavailable`,
  newRider: `New Rider`,
  played: `Played`,
  won: `Won`,
  landed: `Landed`,
  chooseRide: `Choose your ride`,
  setPreference: `Set preference`,
  gameRules: `Game rules`,
  riderPolicy: `Rider policy`,
  disciplineWordDescription: {
    prefix: `You play a game of`,
    suffix: `— miss and you collect the next letter.`,
    fallback: `Pick Roller, Skateboard, BMX or Scooter — your elimination word appears here.`,
  },
  rankingErrorTitle: `ranking request failed`,
  apiRankingPath: `/api/ranking/me`,
} as const;

const UI_TEMPLATES = {
  eliminationWordAria: (word: string) => `Elimination word ${word}`,
  points: (totalPoints: number) => `${totalPoints} points`,
  joinPath: (code: string) => `/games/join/${encodeURIComponent(code)}`,
  describedByWithError: (baseId: string, errorId: string) =>
    `${baseId} ${errorId}`,
  headerHelp: (a: string, b: string) => `${a} · ${b}`,
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
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const searchParams = useNextSearchParams();
  const prefill = useMemo(() => parseGamePrefill(searchParams), [searchParams]);
  const preferredSport = usePreferencesStore((s) => s.preferredSport);
  const preferencesHydrationStatus = usePreferencesStore(
    (s) => s.hydrationStatus,
  );
  const openPreferences = useUIStore((s) => s.openPreferences);
  const discipline = resolveGameDiscipline(preferredSport);
  const riderActivity = useRiderActivity(signedIn);

  useEffect(() => {
    if ([`ready`, `error`].includes(preferencesHydrationStatus) && !discipline)
      openPreferences();
  }, [discipline, openPreferences, preferencesHydrationStatus]);

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
      <div className="flex flex-1 flex-col bg-gradient-to-b from-cyan-400 via-teal-400 to-teal-600 px-5 py-4 sm:px-6 sm:py-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col">
          <div className={`z-30 py-2`}>
            <div className={`mx-auto flex justify-center max-w-6xl gap-2`}>
              <JoinWithCode variant="games" />
              {signedIn ? (
                <button
                  type="button"
                  onClick={() => setProgressOpen(true)}
                  aria-expanded={progressOpen}
                  aria-controls={`rider-progress-drawer`}
                  className={`inline-flex min-h-11 items-center rounded-full border border-outline-variant bg-surface-container-lowest/95 px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface shadow-[0_4px_16px_rgba(18,18,18,0.08)] backdrop-blur-sm transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px`}
                >
                  {UI_COPY.yourRecord}
                </button>
              ) : null}
            </div>
          </div>
          <LandingInfo
            discipline={discipline}
            onOpenRules={() => setRulesOpen(true)}
            onOpenPolicy={() => setPolicyOpen(true)}
            onOpenPreferences={openPreferences}
          />
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
        </div>
      </div>
      <RulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
      <ResponsibilityPolicyModal
        isOpen={policyOpen}
        onClose={() => setPolicyOpen(false)}
      />
      {signedIn ? (
        <SideDrawer
          isOpen={progressOpen}
          onClose={() => setProgressOpen(false)}
          labelledBy={`rider-progress-drawer-title`}
          contentId={`rider-progress-drawer`}
          testId={`rider-progress-drawer`}
          side={`left`}
          panelClassName={`w-[min(28rem,calc(100vw-1rem))] border-r border-outline-variant`}
        >
          <div
            className={`flex items-start justify-between gap-4 border-b border-outline-variant p-5 sm:p-6`}
          >
            <div>
              <p
                className={`font-display text-xs font-semibold uppercase tracking-[0.05em] text-secondary`}
              >
                {UI_COPY.challengeRecord}
              </p>
              <h2
                id={`rider-progress-drawer-title`}
                className={`mt-2 font-display text-3xl font-bold uppercase leading-none`}
              >
                {UI_COPY.yourRecord}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setProgressOpen(false)}
              aria-label={UI_COPY.closeYourRecord}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-outline-variant bg-surface-container-high text-on-surface transition-colors hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div
            className={`min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-5`}
          >
            <RiderProgressContent
              ranking={ranking}
              rankingError={rankingError}
              activity={riderActivity}
              activityHeadingId={`rider-activity-title-mobile`}
              onViewMatches={() => {
                setProgressOpen(false);
                setMatchesOpen(true);
              }}
            />
          </div>
        </SideDrawer>
      ) : null}
      {signedIn ? (
        <MatchesDrawer
          isOpen={matchesOpen}
          onClose={() => setMatchesOpen(false)}
        />
      ) : null}
    </>
  );
}

function LandingInfo({
  discipline,
  onOpenRules,
  onOpenPolicy,
  onOpenPreferences,
}: {
  discipline: ReturnType<typeof resolveGameDiscipline>;
  onOpenRules: () => void;
  onOpenPolicy: () => void;
  onOpenPreferences: () => void;
}) {
  const definition: GameDefinition | null = discipline
    ? GAME_DEFINITIONS[discipline]
    : null;
  const eliminationWord = definition?.eliminationWord ?? null;

  return (
    <div className={`space-y-4 mt-4 sm:mt-8`}>
      {/* Current discipline — single, preferred sport only */}
      <div
        className={`rounded-[16px] border border-outline-variant bg-surface-container-lowest p-4 sm:p-5`}
      >
        <div className={`flex flex-wrap items-start justify-between gap-3`}>
          <div className={`min-w-0`}>
            <p
              className={`mt-1 max-w-2xl text-xs leading-5 text-on-surface-variant`}
            >
              {discipline && eliminationWord ? (
                <>
                  {`${UI_COPY.disciplineWordDescription.prefix} `}
                  <span className={`font-semibold text-on-surface`}>
                    {eliminationWord}
                  </span>
                  {` ${UI_COPY.disciplineWordDescription.suffix}`}
                </>
              ) : (
                <>{`${UI_COPY.disciplineWordDescription.fallback}`}</>
              )}
            </p>
          </div>
          {discipline && eliminationWord ? (
            <span
              aria-label={UI_TEMPLATES.eliminationWordAria(eliminationWord)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3 py-1.5 font-display text-xs font-bold uppercase tracking-[0.08em]`}
            >
              <span className={`tracking-[0.18em]`}>{eliminationWord}</span>
              <span
                className={`rounded-full bg-on-surface px-1.5 py-0.5 text-[10px] leading-none tracking-[0.05em] text-surface`}
              >
                {`${eliminationWord.length}`}
              </span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenPreferences}
              className={`inline-flex min-h-9 shrink-0 items-center rounded-full border border-outline-variant bg-surface-container-lowest px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:border-outline hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
            >
              {UI_COPY.setPreference}
            </button>
          )}
        </div>
        <div className={`mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-3`}>
          <button
            type="button"
            onClick={onOpenRules}
            className={`inline-flex min-h-9 items-center rounded-full border border-outline-variant bg-surface-container px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:border-outline hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
          >
            {UI_COPY.gameRules}
          </button>
          <button
            type="button"
            onClick={onOpenPolicy}
            className={`inline-flex min-h-9 items-center rounded-full border border-outline-variant bg-surface-container px-3.5 font-display text-[11px] font-bold uppercase tracking-[0.05em] text-on-surface transition-colors hover:border-outline hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2`}
          >
            {UI_COPY.riderPolicy}
          </button>
        </div>
      </div>
    </div>
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
  onViewMatches,
}: {
  ranking: Ranking | null;
  rankingError: boolean;
  activity: RiderActivityData;
  activityHeadingId: string;
  onViewMatches: () => void;
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

        <div className={`mt-3 flex w-full sm:mt-4`}>
          <button
            type="button"
            onClick={onViewMatches}
            className={`inline-flex min-h-11 w-full items-center justify-center rounded-full border border-outline-variant bg-surface-container-high px-4 font-display text-xs font-bold uppercase tracking-[0.05em] text-on-surface transition-[background-color,border-color,transform] hover:border-outline hover:bg-surface-container-highest focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4 active:translate-y-px`}
          >
            {UI_COPY.viewMatches}
          </button>
        </div>

        <div
          className={`mt-6 border-t border-outline-variant pt-5 sm:mt-8 sm:pt-6`}
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
