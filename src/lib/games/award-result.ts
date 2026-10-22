import type {
  GameHistoryResponse,
  GameState,
  GameStage,
} from "@/lib/schemas/game";

export type AwardResultRow = {
  rank: number;
  playerId: string;
  displayName: string;
  letters: string;
  eliminationProgress: string;
  points: number;
  landed: number;
  failed: number;
  eliminated: boolean;
  isWinner: boolean;
  isViewer: boolean;
  seatOrder: number;
  failedAttempts: number;
};

export type AwardResult = {
  gameId: string;
  mode: "training" | "challenge";
  variant: "multiplayer" | "solo";
  disciplineSlug: string;
  status: string;
  winner: AwardResultRow | null;
  ranking: readonly AwardResultRow[];
  soloRow: AwardResultRow | null;
  totals: {
    rounds: number;
    spotTypesUsed: readonly string[];
    scheduledAt: string | null;
    durationLabel: string | null;
  };
  copy: { headline: string; sub: string; badge: string };
  image: { src: "/challenges.jpg" | "/trainings.jpg"; alt: string };
  source: "live" | "history";
};

function resolveWinnerId(game: GameState): string | null {
  if (game.winnerPlayerId) return game.winnerPlayerId;
  if (game.status === "complete") {
    const active = game.players.filter((p) => p.status === "active");
    if (active.length === 1 && active[0]) return active[0].id;
  }
  return null;
}

function stageLedgerFor(game: GameState, history?: GameHistoryResponse | null): readonly GameStage[] {
  if (history?.rounds) return history.rounds;
  return game.stageLedger ?? [];
}

function pointsForPlayer(stages: readonly GameStage[], playerId: string): number {
  let total = 0;
  for (const stage of stages) {
    const score = stage.scores.find((s) => s.playerId === playerId);
    if (score) total += score.points;
  }
  return total;
}

function landedFailedForPlayer(
  stages: readonly GameStage[],
  playerId: string,
): { landed: number; failed: number } {
  let landed = 0;
  let failed = 0;
  for (const stage of stages) {
    for (const a of stage.attempts) {
      if (a.playerId !== playerId) continue;
      if (a.result === "landed") landed += 1;
      else if (a.result === "failed") failed += 1;
    }
  }
  return { landed, failed };
}

function buildRows(
  game: GameState,
  stages: readonly GameStage[],
  winnerId: string | null,
): AwardResultRow[] {
  const rows: Omit<AwardResultRow, "rank">[] = [];
  for (const player of game.players) {
    const points = pointsForPlayer(stages, player.id);
    const { landed, failed } = landedFailedForPlayer(stages, player.id);
    const isWinner = player.id === winnerId;
    const eliminated = player.status === "eliminated";
    const eliminationProgress =
      game.eliminationWord && player.letters
        ? `${player.letters} / ${game.eliminationWord}`
        : player.letters
          ? player.letters
          : "";
    rows.push({
      playerId: player.id,
      displayName: player.displayName,
      letters: player.letters,
      eliminationProgress,
      points,
      landed,
      failed,
      eliminated,
      isWinner,
      isViewer: game.viewerPlayerId !== null && game.viewerPlayerId === player.id,
      seatOrder: player.seatOrder,
      failedAttempts: player.failedAttempts,
    });
  }

  // sort by isWinner desc → points desc → failedAttempts asc → seatOrder asc
  rows.sort((a, b) => {
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    if (a.points !== b.points) return b.points - a.points;
    if (a.failedAttempts !== b.failedAttempts) return a.failedAttempts - b.failedAttempts;
    return a.seatOrder - b.seatOrder;
  });

  // dense ranking: tied on points share rank, next rank = prevRank+1 (not index+1)
  // An eliminated rider must not share rank 1 with an active winner even if both have 0 points.
  const ranked: AwardResultRow[] = [];
  let prevRow: AwardResultRow | null = null;
  let prevRank = 1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;
    let rank: number;
    const isTie =
      prevRow !== null &&
      row.points === prevRow.points &&
      row.eliminated === prevRow.eliminated;

    if (i === 0) {
      rank = 1;
      prevRank = 1;
    } else if (isTie) {
      rank = prevRank;
    } else {
      rank = prevRank + 1;
      prevRank = rank;
    }
    const rankedRow: AwardResultRow = { ...row, rank };
    ranked.push(rankedRow);
    prevRow = rankedRow;
  }
  return ranked;
}

function formatDiscipline(disciplineSlug: string): string {
  if (!disciplineSlug) return disciplineSlug;
  return disciplineSlug.charAt(0).toUpperCase() + disciplineSlug.slice(1);
}

function buildCopy(
  game: GameState,
  winner: AwardResultRow | null,
  _ranking: readonly AwardResultRow[],
  soloRow: AwardResultRow | null,
  totals: AwardResult["totals"],
): AwardResult["copy"] {
  const disciplineLabel = formatDiscipline(game.disciplineSlug);
  const isSolo = game.trainingVariant === "solo";
  const hasLedger = totals.rounds > 0;
  const isCancelled = game.status === "cancelled";

  if (isSolo && soloRow) {
    const landed = soloRow.landed;
    const failed = soloRow.failed;
    return {
      headline: "Nice session!",
      sub: `${landed} landed \u00B7 ${failed} missed \u00B7 ${disciplineLabel} \u00B7 ${totals.rounds} ${totals.rounds === 1 ? "round" : "rounds"}`,
      badge: "Session complete",
    };
  }

  if (winner) {
    if (game.mode === "challenge") {
      return {
        headline: `${winner.displayName} takes ${game.eliminationWord}!`,
        sub: `${winner.displayName} cleared the line \u2014 ${winner.points} pts \u00B7 ${winner.landed} tricks landed`,
        badge: `Champion \u2014 ${disciplineLabel}`,
      };
    }
    return {
      headline: `${winner.displayName} on top!`,
      sub: `Crew cleared \u2014 ${winner.points} pts`,
      badge: `Top rider \u2014 ${disciplineLabel}`,
    };
  }

  // no winner cases
  if (isCancelled && hasLedger) {
    return {
      headline: "Session closed \u2014 no champion",
      sub: `Crew headed out early \u2014 ${totals.rounds} ${totals.rounds === 1 ? "round" : "rounds"} in`,
      badge: "No champion",
    };
  }

  // complete no winner or lobby/active with no winner yet but ledger>0 (treat same)
  if (hasLedger) {
    return {
      headline: "That\u2019s a wrap \u2014 no champion",
      sub: `Everyone stayed in \u2014 ${totals.rounds} ${totals.rounds === 1 ? "round" : "rounds"} in`,
      badge: "Session complete",
    };
  }

  // empty ledger fallback (should not render dialog but copy still defined)
  return {
    headline: isCancelled ? "Session closed \u2014 no champion" : "That\u2019s a wrap \u2014 no champion",
    sub: "No rounds were settled \u2014 the crew headed out before a line was set.",
    badge: hasLedger ? "Session complete" : "No champion",
  };
}

export function buildAwardResult(
  game: GameState,
  history?: GameHistoryResponse | null,
): AwardResult {
  const stages = stageLedgerFor(game, history ?? null);
  const winnerId = resolveWinnerId(game);
  const ranked = buildRows(game, stages, winnerId);
  const winner = ranked.find((r) => r.isWinner) ?? null;
  const isSolo = game.trainingVariant === "solo";
  const soloRow = isSolo ? (ranked[0] ?? null) : null;

  const spotTypesUsed = [...new Set(stages.map((s) => s.spotType))];
  const totals: AwardResult["totals"] = {
    rounds: stages.length,
    spotTypesUsed,
    scheduledAt: game.scheduledStartAt ?? null,
    durationLabel: null,
  };

  const copy = buildCopy(game, winner, ranked, soloRow, totals);
  const imageSrc = game.mode === "challenge" ? "/challenges.jpg" : "/trainings.jpg";
  const imageAlt = `${game.mode === "challenge" ? "Challenge" : "Training"} award \u2014 ${game.disciplineSlug} \u00B7 championship results`;

  return {
    gameId: game.id,
    mode: game.mode,
    variant: game.trainingVariant,
    disciplineSlug: game.disciplineSlug,
    status: game.status,
    winner,
    ranking: ranked,
    soloRow,
    totals,
    copy,
    image: { src: imageSrc as AwardResult["image"]["src"], alt: imageAlt },
    source: history ? "history" : "live",
  };
}

export function rankingForDisplay(result: AwardResult): readonly AwardResultRow[] {
  return result.ranking;
}

export function copyForResult(result: AwardResult): AwardResult["copy"] {
  return result.copy;
}
