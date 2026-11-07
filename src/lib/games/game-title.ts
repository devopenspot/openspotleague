/**
 * Rider-facing game title.
 *
 * Stored names are "Play a Skate" / "Play a Blade" / … (pinned by a DB check
 * constraint), but riders know the game as "Game of S.K.A.T.E". Convert at
 * display time; stored data never changes.
 */

const STORED_NAME = /^Play an? ([A-Za-z]+)$/i;

/** "SKATE" → "S.K.A.T.E" */
export function dottedWord(word: string): string {
  return word.toUpperCase().split("").join(".");
}

export function gameTitle({
  gameName,
  eliminationWord,
}: {
  gameName: string;
  eliminationWord?: string | null;
}): string {
  const word = eliminationWord?.trim() || STORED_NAME.exec(gameName.trim())?.[1];
  return word ? `Game of ${dottedWord(word)}` : gameName;
}
