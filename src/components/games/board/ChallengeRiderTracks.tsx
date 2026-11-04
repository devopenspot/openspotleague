import { Flag, Trophy } from "lucide-react";
import type { GameState } from "@/lib/schemas/game";
import { totalLedgerPoints } from "@/lib/games/challenge-board-model";
import { LetterTrack } from "@/components/games/shared/LetterTrack";

export function ChallengeRiderTracksContent({
  game,
  headingId,
  showHeader = true,
}: {
  game: GameState;
  headingId: string;
  showHeader?: boolean;
}) {
  const viewerHasAuthoritativePoints =
    game.mode === "challenge" && game.viewerPoints !== null;

  return (
    <>
      {showHeader ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-[0.05em] text-secondary md:text-xs">
              Who’s Riding
            </p>
            <h2
              id={headingId}
              className="mt-1 font-display text-xl font-semibold leading-[1.3]"
            >
              Crew Board
            </h2>
          </div>
          <Flag size={18} aria-hidden="true" />
        </div>
      ) : null}

      <div
        className={`${showHeader ? "mt-3 sm:mt-4" : "mt-0"} divide-y divide-outline-variant border-y border-outline-variant`}
      >
        {game.players.length === 0 ? (
          <p className="py-3 text-xs leading-5 text-on-surface-variant sm:text-sm">
            No Crew Yet — Share The Code To Get Started!
          </p>
        ) : (
          game.players.map((player) => {
            const isViewer = player.id === game.viewerPlayerId;
            const isLeader = player.id === game.currentChallengerPlayerId;
            const roundPoints = totalLedgerPoints(game, player.id);
            const totalPoints =
              isViewer && viewerHasAuthoritativePoints
                ? (game.viewerPoints ?? roundPoints)
                : roundPoints;
            const riderLabel =
              game.trainingVariant === "solo"
                ? isViewer
                  ? "You — Solo Run"
                  : isLeader
                    ? "Riding Now"
                    : player.status === "active"
                      ? "In The Crew"
                      : player.status
                : player.id === game.winnerPlayerId
                  ? "Winner!"
                  : player.status === "eliminated"
                    ? "Out — Nice Try!"
                    : isViewer
                      ? "You"
                      : isLeader
                        ? "Leads The Trick"
                        : player.status === "active"
                          ? "In The Crew"
                          : player.status;

            return (
              <article
                key={player.id}
                className="py-2.5 first:pt-2.5 last:pb-2.5 sm:py-3 sm:first:pt-3 sm:last:pb-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-semibold leading-[1.3] text-on-surface sm:text-xl">
                      {player.displayName}
                    </h3>
                    <p className="mt-1 font-display text-sm uppercase tracking-[0.05em] text-secondary md:text-xs">
                      {riderLabel}
                    </p>
                  </div>
                  {player.id === game.winnerPlayerId ? (
                    <Trophy size={17} aria-label="Winner" />
                  ) : null}
                </div>

                {game.trainingVariant === "solo" ? (
                  <p className="mt-2 rounded-[8px] border border-outline-variant bg-surface-container-high px-2 py-2 font-display text-sm font-semibold uppercase tracking-[0.05em] text-secondary md:text-xs">
                    Free Ride — Keep Going Until You Finish Your Run
                  </p>
                ) : (
                  <LetterTrack
                    word={game.eliminationWord}
                    letters={player.letters}
                    label={`${player.displayName} elimination progress`}
                    className="mt-2"
                  />
                )}

                {game.mode === "challenge" ? (
                  <p className="mt-2 font-display text-sm font-bold uppercase tracking-[0.05em] text-secondary md:text-xs">
                    {totalPoints} Pts · {isViewer ? "Your Total" : "Session Score"}
                  </p>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
