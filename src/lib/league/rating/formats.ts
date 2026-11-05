/**
 * Contest formats for the League rating engine. Source: Article 9
 * ("Metodología de Selectivo Técnico"), Resolución 082/2026 of the
 * Federación Colombiana de Patinaje, extended to every discipline.
 * Pure: no IO. See docs/league.md, "Rating".
 */

export const RATING_DISCIPLINES = ["roller", "skateboard", "bmx", "scooter"] as const;
export type RatingDiscipline = (typeof RATING_DISCIPLINES)[number];

/** `open` is the legacy format: contests created before divisions existed. */
export const CONTEST_FORMATS = ["park", "street", "vert", "open"] as const;
export type ContestFormat = (typeof CONTEST_FORMATS)[number];

/** Formats a new division can use (`open` is backfill-only). */
export const RATED_FORMATS = ["park", "street", "vert"] as const;
export type RatedFormat = (typeof RATED_FORMATS)[number];

export interface FormatTemplate {
  format: RatedFormat;
  label: string;
  /** Run length riders should film or ride. Guidance only; not enforced. */
  runSeconds: number;
  /** Street adds a separately scored best trick. */
  hasBestTrick: boolean;
  summary: string;
}

export const FORMAT_TEMPLATES: Readonly<Record<RatedFormat, FormatTemplate>> = {
  park: {
    format: "park",
    label: "Park",
    runSeconds: 50,
    hasBestTrick: false,
    summary: "One 50-second run in a bowl-style park.",
  },
  street: {
    format: "street",
    label: "Street",
    runSeconds: 50,
    hasBestTrick: true,
    summary: "One 50-second run on a street course, plus one best trick.",
  },
  vert: {
    format: "vert",
    label: "Vert",
    runSeconds: 45,
    hasBestTrick: false,
    summary: "One 45-second run on a vert ramp.",
  },
};

export function isRatedFormat(value: string): value is RatedFormat {
  return (RATED_FORMATS as readonly string[]).includes(value);
}

export function isContestFormat(value: string): value is ContestFormat {
  return (CONTEST_FORMATS as readonly string[]).includes(value);
}

export function isRatingDiscipline(value: string): value is RatingDiscipline {
  return (RATING_DISCIPLINES as readonly string[]).includes(value);
}

const DISCIPLINE_LABELS: Readonly<Record<RatingDiscipline, string>> = {
  roller: "Roller",
  skateboard: "Skateboard",
  bmx: "BMX",
  scooter: "Scooter",
};

export function disciplineLabel(discipline: RatingDiscipline): string {
  return DISCIPLINE_LABELS[discipline];
}

export function formatLabel(format: ContestFormat): string {
  return format === "open" ? "Open" : FORMAT_TEMPLATES[format].label;
}

/** "Roller · Park" */
export function divisionLabel(discipline: RatingDiscipline, format: ContestFormat): string {
  return `${disciplineLabel(discipline)} · ${formatLabel(format)}`;
}
