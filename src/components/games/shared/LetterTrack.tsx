/**
 * Elimination word as a row of tiles: earned letters are filled, the rest
 * stay empty. Shared by the live crew board and the end-of-game standings so
 * both read the same.
 */
export function LetterTrack({
  word,
  letters,
  label,
  className = "",
}: {
  word: string;
  letters: string;
  /** Accessible name for the whole track, e.g. "Alice: 2 of 5 letters". */
  label: string;
  className?: string;
}) {
  const tiles = Array.from(word);
  return (
    <div
      role="img"
      aria-label={label}
      className={`grid gap-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((letter, index) => {
        const earned = letters[index];
        return (
          <span
            key={`${letter}-${index}`}
            aria-hidden="true"
            className={`flex h-7 items-center justify-center rounded-sm border font-display text-sm font-bold ${
              earned
                ? "border-on-surface bg-on-surface text-surface"
                : "border-outline-variant bg-surface-container-high text-secondary"
            }`}
          >
            {earned ?? "-"}
          </span>
        );
      })}
    </div>
  );
}
